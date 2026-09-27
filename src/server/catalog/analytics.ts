import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { catalogEventDays as days } from "@/db/schema/directoryOperations";
import {
  listingLinks,
  listings,
  navigationPresets,
  tags,
} from "@/db/schema/directory";
import { publicVisibility, type CatalogExecutor } from "./service";

const HONG_KONG_TIME_ZONE = "Asia/Hong_Kong";
const ACTION_MAX_AGE_MS = 10 * 60 * 1000;
const ACTION_FUTURE_SKEW_MS = 60 * 1000;
const RECEIPT_RETENTION_MS = 7 * 86400000;
const AGGREGATE_RETENTION_DAYS = 90;
const SUPPRESSED_QUERY = "[已隱藏]";
const OVERFLOW_KEY = "[其他]";
const FILTER_KEY = "applied";

export type CatalogEvent = {
  kind: "search" | "filter" | "preset" | "tag" | "outbound";
  key: string;
  source: "web" | "bot";
  actionId: string;
  occurredAt?: string | Date | number;
  zeroResult?: boolean;
};

export type AnalyticsSource = "all" | CatalogEvent["source"];
export type AnalyticsWriteStatus =
  | "recorded"
  | "ignored"
  | "disabled"
  | "degraded";

export type CatalogEventReceipt = {
  actionId: string;
  occurredAt: string;
  signature: string;
};

export function analyticsEnabled() {
  return !["0", "false", "off"].includes(
    (process.env.DIRECTORY_ANALYTICS_ENABLED ?? "true").toLowerCase(),
  );
}

function analyticsSecret() {
  return process.env.ANALYTICS_ACTION_SECRET ?? process.env.AUTH_SESSION_SECRET;
}

function signReceipt(actionId: string, occurredAt: string) {
  const secret = analyticsSecret();
  return secret
    ? createHmac("sha256", secret)
        .update(`${actionId}:${occurredAt}`)
        .digest("hex")
    : null;
}

export function issueCatalogEventReceipt(
  now = new Date(),
): CatalogEventReceipt | null {
  const actionId = randomUUID(), occurredAt = now.toISOString();
  const signature = signReceipt(actionId, occurredAt);
  return signature ? { actionId, occurredAt, signature } : null;
}

export function verifyCatalogEventReceipt(receipt: CatalogEventReceipt) {
  const expected = signReceipt(receipt.actionId, receipt.occurredAt);
  if (!expected || !/^[a-f0-9]{64}$/.test(receipt.signature)) return false;
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(receipt.signature, "hex"),
  );
}

export function hongKongDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HONG_KONG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function privateQueryKey(input: string): string | null {
  const value = input
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (
    value.length < 2 ||
    value.length > 80 ||
    /[@:/\\]|\d{4}|(?:密碼|password|token|secret|身份證|身分證|電話|電郵|住址)/i.test(
      value,
    )
  )
    return null;
  if (!/^[\p{L}\p{N}\s#＆&・·-]+$/u.test(value)) return null;
  return value;
}

async function validEntityEvent(event: CatalogEvent, executor: CatalogExecutor) {
  if (event.kind === "search" || event.kind === "filter") return true;
  if (!/^\d{1,10}$/.test(event.key)) return false;
  const id = Number(event.key);
  if (event.kind === "tag") {
    const rows = await executor
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.id, id),
          eq(tags.enabled, true),
          eq(tags.filterable, true),
          event.source === "bot"
            ? eq(tags.botVisible, true)
            : eq(tags.publicVisible, true),
        ),
      )
      .limit(1);
    return rows.length === 1;
  }
  if (event.kind === "preset") {
    const placement = event.source === "web" ? "public" : "bot";
    const rows = await executor
      .select({ id: navigationPresets.id })
      .from(navigationPresets)
      .where(
        and(
          eq(navigationPresets.id, id),
          eq(navigationPresets.enabled, true),
          inArray(navigationPresets.placement, [placement, "both"]),
        ),
      )
      .limit(1);
    return rows.length === 1;
  }
  if (event.source !== "web") return false;
  return Boolean(await enabledOutboundLink(id, executor));
}

export async function recordCatalogEvent(
  event: CatalogEvent,
  executor: CatalogExecutor = db,
  options: { now?: Date } = {},
): Promise<AnalyticsWriteStatus> {
  if (!analyticsEnabled()) return "disabled";
  const now = options.now ?? new Date();
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : now;
  const age = now.getTime() - occurredAt.getTime();
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    age > ACTION_MAX_AGE_MS ||
    age < -ACTION_FUTURE_SKEW_MS ||
    !["web", "bot"].includes(event.source) ||
    !["search", "filter", "preset", "tag", "outbound"].includes(event.kind)
  )
    return "ignored";
  const secret = analyticsSecret();
  if (!secret) return "degraded";
  try {
    const eligibleQuery =
      event.kind === "search" ? privateQueryKey(event.key) : null;
    const key =
      event.kind === "search"
        ? eligibleQuery ?? SUPPRESSED_QUERY
        : event.kind === "filter"
          ? FILTER_KEY
          : /^\d{1,10}$/.test(event.key)
            ? event.key
            : null;
    if (!key) return "ignored";
    const day = hongKongDay(occurredAt);
    const id = createHmac("sha256", secret)
      .update(`${event.source}:${event.actionId}`)
      .digest("hex");
    const write = async (tx: CatalogExecutor) => {
      if (!(await validEntityEvent(event, tx))) return false;
      const prior = await tx.execute<{
        statement_timeout: string;
        lock_timeout: string;
      }>(
        sql`select current_setting('statement_timeout') as statement_timeout,current_setting('lock_timeout') as lock_timeout`,
      );
      await tx.execute(
        sql`select set_config('statement_timeout','750ms',true),set_config('lock_timeout','250ms',true)`,
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(724112, ${Number(day.replaceAll("-", ""))})`,
      );
      await tx.execute(sql`with receipt as (
        insert into directory_event_receipts(id,created_at) values(${id},${occurredAt}) on conflict do nothing returning id
      ), bounded as (
        select case when (select count(*) from directory_event_days where day=${day}::date) < 2000
          or exists(select 1 from directory_event_days where day=${day}::date and source=${event.source} and kind=${event.kind} and key=${key})
          then ${key} else ${OVERFLOW_KEY} end as key from receipt
      ) insert into directory_event_days(day,source,kind,key,count,zero_count)
        select ${day}::date,${event.source},${event.kind},key,1,${(event.kind === "search" || event.kind === "filter") && event.zeroResult ? 1 : 0} from bounded
        on conflict(day,source,kind,key) do update set count=directory_event_days.count+1,zero_count=directory_event_days.zero_count+excluded.zero_count`);
      await tx.execute(
        sql`select set_config('statement_timeout',${prior[0].statement_timeout},true),set_config('lock_timeout',${prior[0].lock_timeout},true)`,
      );
      return true;
    };
    return (await executor.transaction(write)) ? "recorded" : "ignored";
  } catch {
    console.warn("Catalog metrics unavailable");
    return "degraded";
  }
}

function emptyReport(
  from: string,
  to: string,
  source: AnalyticsSource,
  status: "disabled" | "degraded",
) {
  return {
    from,
    to,
    source,
    rows: [],
    summary: {
      searches: 0,
      zeroResults: 0,
      zeroRate: null,
      filteredDiscoveries: 0,
      suppressedSearches: 0,
    },
    collection: {
      status,
      timeZone: HONG_KONG_TIME_ZONE,
      retentionDays: AGGREGATE_RETENTION_DAYS,
      collectionStart: null,
      todayIncomplete: to >= hongKongDay(),
    },
    meaning:
      "觀察到的操作次數，不代表獨立使用者或成交。Telegram 直接 URL 按鈕點擊不可觀測。",
  };
}

export async function analyticsReport(
  from: string,
  to: string,
  source: AnalyticsSource = "all",
) {
  if (!analyticsEnabled()) return emptyReport(from, to, source, "disabled");
  try {
    const sourceWhere = source === "all" ? undefined : eq(days.source, source);
    const [rows, [first], [totals]] = await Promise.all([
      db
        .select({
          source: days.source,
          kind: days.kind,
          key: days.key,
          count: sql<number>`sum(${days.count})::int`,
          zeroCount: sql<number>`sum(${days.zeroCount})::int`,
        })
        .from(days)
        .where(and(gte(days.day, from), lte(days.day, to), sourceWhere))
        .groupBy(days.source, days.kind, days.key)
        .orderBy(sql`sum(${days.count}) desc`)
        .limit(200),
      db
        .select({ day: sql<string | null>`min(${days.day})::text` })
        .from(days)
        .where(sourceWhere),
      db
        .select({
          searches: sql<number>`coalesce(sum(${days.count}) filter (where ${days.kind}='search'),0)::int`,
          zeroResults: sql<number>`coalesce(sum(${days.zeroCount}) filter (where ${days.kind}='search'),0)::int`,
          filteredDiscoveries: sql<number>`coalesce(sum(${days.count}) filter (where ${days.kind}='filter'),0)::int`,
          suppressedSearches: sql<number>`coalesce(sum(${days.count}) filter (where ${days.kind}='search' and ${days.key}=${SUPPRESSED_QUERY}),0)::int`,
        })
        .from(days)
        .where(and(gte(days.day, from), lte(days.day, to), sourceWhere)),
    ]);
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
    const tagIds = rows
      .filter((row) => row.kind === "tag" && /^\d+$/.test(row.key))
      .map((row) => Number(row.key));
    const presetIds = rows
      .filter((row) => row.kind === "preset" && /^\d+$/.test(row.key))
      .map((row) => Number(row.key));
    const [tagLabels, presetLabels] = await Promise.all([
      tagIds.length
        ? db.select({ id: tags.id, label: tags.name }).from(tags).where(inArray(tags.id, tagIds))
        : [],
      presetIds.length
        ? db
            .select({ id: navigationPresets.id, label: navigationPresets.label })
            .from(navigationPresets)
            .where(inArray(navigationPresets.id, presetIds))
        : [],
    ]);
    const labels = new Map<string, string>([
      ...tagLabels.map((tag) => [`tag:${tag.id}`, tag.label] as const),
      ...presetLabels.map(
        (preset) => [`preset:${preset.id}`, preset.label] as const,
      ),
      ...outbound.map(
        (link) =>
          [`outbound:${link.id}`, `${link.name} · ${link.label}`] as const,
      ),
      [`search:${SUPPRESSED_QUERY}`, "已隱藏的搜尋"],
      [`filter:${FILTER_KEY}`, "已套用結構化條件"],
    ]);
    return {
      from,
      to,
      source,
      rows: rows.map((row) => ({
        ...row,
        label: labels.get(`${row.kind}:${row.key}`) ?? row.key,
        queryLabelEligible:
          row.kind !== "search" ||
          ![SUPPRESSED_QUERY, OVERFLOW_KEY].includes(row.key),
      })),
      summary: {
        ...totals,
        zeroRate: totals.searches
          ? totals.zeroResults / totals.searches
          : null,
      },
      collection: {
        status: "enabled" as const,
        timeZone: HONG_KONG_TIME_ZONE,
        retentionDays: AGGREGATE_RETENTION_DAYS,
        collectionStart: first.day,
        todayIncomplete: from <= hongKongDay() && to >= hongKongDay(),
      },
      meaning:
        "觀察到的操作次數，不代表獨立使用者或成交。重複的真實操作可以重複計算；Telegram 直接 URL 按鈕點擊不可觀測。",
    };
  } catch {
    return emptyReport(from, to, source, "degraded");
  }
}

export async function cleanupAnalytics(
  executor: CatalogExecutor = db,
  options: { now?: Date; batchSize?: number } = {},
) {
  const now = options.now ?? new Date();
  const batchSize = Math.min(Math.max(options.batchSize ?? 1000, 1), 5000);
  const aggregateBefore = hongKongDay(
    new Date(now.getTime() - AGGREGATE_RETENTION_DAYS * 86400000),
  );
  const receiptBefore = new Date(now.getTime() - RECEIPT_RETENTION_MS);
  const aggregateRows = await executor.execute<{ day: string }>(sql`
    delete from directory_event_days where ctid in (
      select ctid from directory_event_days where day < ${aggregateBefore}::date order by day limit ${batchSize}
    ) returning day::text
  `);
  const receiptRows = await executor.execute<{ id: string }>(sql`
    delete from directory_event_receipts where ctid in (
      select ctid from directory_event_receipts where created_at < ${receiptBefore} order by created_at limit ${batchSize}
    ) returning id
  `);
  return { aggregates: aggregateRows.length, receipts: receiptRows.length };
}

export async function deleteStoredQuery(
  value: string,
  executor: CatalogExecutor = db,
) {
  const key = privateQueryKey(value);
  if (!key) return 0;
  const rows = await executor.execute<{ key: string }>(sql`
    delete from directory_event_days where kind='search' and key=${key} returning key
  `);
  return rows.length;
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
