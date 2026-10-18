import { sql } from "drizzle-orm";
import { db } from "./db";
import type { CatalogExecutor } from "./catalog/service";

export const MAX_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export async function cleanupAuthentication(
  executor: CatalogExecutor = db,
  now = new Date(),
  batchSize = 1000,
) {
  const cap = Math.max(1, Math.min(5000, Math.floor(batchSize)));
  const cutoff = new Date(now.getTime() - MAX_RATE_WINDOW_MS);
  const hits = await executor.execute(
    sql`delete from rate_limit_entries where id in (select id from rate_limit_entries where hit_at < ${cutoff} order by hit_at limit ${cap} for update skip locked) returning id`,
  );
  const sessions = await executor.execute(
    sql`delete from auth_sessions where id in (select id from auth_sessions where expires_at < ${now} order by expires_at limit ${cap} for update skip locked) returning id`,
  );
  const failures = await executor.execute(
    sql`delete from login_failures where id in (select id from login_failures where first_failure < ${cutoff} and (locked_until is null or locked_until < ${now}) order by first_failure limit ${cap} for update skip locked) returning id`,
  );
  return {
    hits: hits.length,
    sessions: sessions.length,
    failures: failures.length,
  };
}
