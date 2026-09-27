import { createHash } from "node:crypto";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { catalogEventDays as days } from "@/db/schema/directoryOperations";
import { listingLinks, listings } from "@/db/schema/directory";
import { getTaxonomy, publicVisibility, type CatalogExecutor } from "./service";

export type CatalogEvent = {
  kind: "search" | "preset" | "tag" | "outbound";
  key: string;
  source: "web" | "bot";
  actionId: string;
  zeroResult?: boolean;
};
export function privateQueryKey(input: string): string | null {
  const value = input
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (
    value.length < 2 ||
    value.length > 80 ||
    /[@:/\\]|\d{4}|(?:密碼|password|token|身份證|身分證|電話|電郵|住址)/i.test(
      value,
    )
  )
    return null;
  if (!/^[\p{L}\p{N}\s#＆&・·-]+$/u.test(value)) return null;
  return value;
}
export async function recordCatalogEvent(
  event: CatalogEvent,
  executor: CatalogExecutor = db,
): Promise<void> {
  try {
    const key =
      event.kind === "search"
        ? privateQueryKey(event.key)
        : /^\d{1,10}$/.test(event.key)
          ? event.key
          : null;
    if (!key) return;
    const day = new Date().toISOString().slice(0, 10);
    const id = createHash("sha256")
      .update(`${event.source}:${event.kind}:${event.actionId}`)
      .digest("hex");
    const write = async (tx: CatalogExecutor) => {
      // Bound lock/query waits and restore the caller's settings on success.
      const prior = await tx.execute<{
        statement_timeout: string;
        lock_timeout: string;
      }>(
        sql`select current_setting('statement_timeout') as statement_timeout,current_setting('lock_timeout') as lock_timeout`,
      );
      await tx.execute(
        sql`select set_config('statement_timeout','750ms',true),set_config('lock_timeout','250ms',true)`,
      );
      // Serialize each day's cardinality check; injected transaction callers retain their connection.
      await tx.execute(
        sql`select pg_advisory_xact_lock(724112, ${Number(day.replaceAll("-", ""))})`,
      );
      await tx.execute(sql`with receipt as (
        insert into directory_event_receipts(id) values(${id}) on conflict do nothing returning id
      ), bounded as (
        select case when (select count(*) from directory_event_days where day=${day}::date) < 2000
          or exists(select 1 from directory_event_days where day=${day}::date and source=${event.source} and kind=${event.kind} and key=${key})
          then ${key} else '[其他]' end as key from receipt
      ) insert into directory_event_days(day,source,kind,key,count,zero_count)
        select ${day}::date,${event.source},${event.kind},key,1,${event.zeroResult ? 1 : 0} from bounded
        on conflict(day,source,kind,key) do update set count=directory_event_days.count+1,zero_count=directory_event_days.zero_count+excluded.zero_count`);
      await tx.execute(
        sql`select set_config('statement_timeout',${prior[0].statement_timeout},true),set_config('lock_timeout',${prior[0].lock_timeout},true)`,
      );
    };
    // A nested transaction becomes a savepoint, so a metrics failure cannot poison a Bot transaction.
    await executor.transaction(write);
  } catch {
    console.warn("Catalog metrics unavailable");
  }
}
export async function analyticsReport(from: string, to: string) {
  const rows = await db
    .select({
      source: days.source,
      kind: days.kind,
      key: days.key,
      count: sql<number>`sum(${days.count})::int`,
      zeroCount: sql<number>`sum(${days.zeroCount})::int`,
    })
    .from(days)
    .where(and(gte(days.day, from), lte(days.day, to)))
    .groupBy(days.source, days.kind, days.key)
    .orderBy(sql`sum(${days.count}) desc`)
    .limit(200);
  const taxonomy = await getTaxonomy("admin");
  const outboundIds = rows
    .filter((row) => row.kind === "outbound" && /^\d+$/.test(row.key))
    .map((row) => Number(row.key));
  const outbound = outboundIds.length
    ? await db
        .select({
          id: listingLinks.id,
          label: listingLinks.label,
          name: listings.name,
        })
        .from(listingLinks)
        .innerJoin(listings, eq(listingLinks.listingId, listings.id))
        .where(inArray(listingLinks.id, outboundIds))
    : [];
  const labels = new Map<string, string>([
    ...taxonomy.tags.map((tag) => [`tag:${tag.id}`, tag.name] as const),
    ...taxonomy.navigation.map(
      (preset) => [`preset:${preset.id}`, preset.label] as const,
    ),
    ...outbound.map(
      (link) =>
        [`outbound:${link.id}`, `${link.name} · ${link.label}`] as const,
    ),
  ]);
  return {
    from,
    to,
    rows: rows.map((row) => ({
      ...row,
      label: labels.get(`${row.kind}:${row.key}`) ?? row.key,
    })),
    meaning:
      "觀察到的操作次數，不代表獨立使用者或成交。Telegram 直接 URL 按鈕點擊不可觀測。",
  };
}
export async function cleanupAnalytics(executor: CatalogExecutor = db) {
  await executor.execute(
    sql`delete from directory_event_days where day < current_date - 90`,
  );
  await executor.execute(
    sql`delete from directory_event_receipts where created_at < now() - interval '7 days'`,
  );
}
export async function enabledOutboundLink(
  id: number,
  executor: CatalogExecutor = db,
) {
  const [link] = await executor
    .select({ id: listingLinks.id, url: listingLinks.url })
    .from(listingLinks)
    .innerJoin(listings, eq(listings.id, listingLinks.listingId))
    .where(
      and(
        eq(listingLinks.id, id),
        eq(listingLinks.enabled, true),
        publicVisibility(),
      ),
    )
    .limit(1);
  return link ?? null;
}
