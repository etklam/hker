import { randomUUID } from "node:crypto";
import { lt } from "drizzle-orm";
import { db, closeDatabase } from "../src/server/db";
import { maintenanceRuns } from "../src/db/schema/directoryOperations";
import { cleanupAnalytics } from "../src/server/catalog/analytics";
import { cleanupContentOperations } from "../src/server/catalog/content-cleanup";
import { cleanupBotState } from "../src/server/catalog/bot-delivery";

const startedAt = new Date();
const counts: Record<string, number | null> = {};
const errors: string[] = [];
const safeCode = (error: unknown) => {
  const value = (error as { code?: unknown })?.code;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value)
    ? value
    : "operation_failed";
};

async function run(name: string, operation: () => Promise<Record<string, number>>) {
  try {
    Object.assign(counts, Object.fromEntries(
      Object.entries(await operation()).map(([key, value]) => [`${name}.${key}`, value]),
    ));
  } catch (error) {
    errors.push(`${name}:${safeCode(error)}`);
    counts[`${name}.failed`] = null;
  }
}

async function main() {
  await run("bot", () => cleanupBotState());
  await run("content", () => cleanupContentOperations());
  await run("analytics", () => cleanupAnalytics());
  await run("maintenance", async () => {
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const removed = await db.delete(maintenanceRuns)
      .where(lt(maintenanceRuns.finishedAt, cutoff))
      .returning({ id: maintenanceRuns.id });
    return { runs: removed.length };
  });
  const status = errors.length ? "failed" : "succeeded";
  await db.insert(maintenanceRuns).values({
    id: randomUUID(),
    kind: "retention",
    status,
    startedAt,
    finishedAt: new Date(),
    counts,
    errorClass: errors.length ? errors.join(",").slice(0, 160) : null,
  });
  console.log(JSON.stringify({ status, startedAt, finishedAt: new Date(), deleted: counts, errors }));
  if (errors.length) process.exitCode = 1;
}

main()
  .catch(() => {
    console.error(JSON.stringify({ status: "failed", errorClass: "cleanup_evidence_write_failed" }));
    process.exitCode = 1;
  })
  .finally(closeDatabase);
