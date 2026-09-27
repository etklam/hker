import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import type { CatalogExecutor } from "./service";
export async function cleanupContentOperations(
  executor: CatalogExecutor = db,
  now = new Date(),
  batchSize = 1000,
) {
  const cap = Math.max(1, Math.min(5000, Math.floor(batchSize)));
  const plans = await executor.execute(
    sql`delete from directory_content_plans where id in (select id from directory_content_plans where expires_at <= ${now} order by expires_at limit ${cap}) returning id`,
  );
  const history = await executor.execute(
    sql`delete from directory_content_history where id in (select id from directory_content_history where created_at < ${new Date(now.getTime() - 90 * 86400000)} order by created_at limit ${cap}) returning id`,
  );
  return { plans: plans.length, history: history.length };
}
