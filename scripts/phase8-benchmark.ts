import { performance } from "node:perf_hooks";
import { db, closeDatabase } from "../src/server/db";
import { sql } from "drizzle-orm";
import { analyticsReport } from "../src/server/catalog/analytics";
import {
  prepareImport,
  commitContentPlan,
  prepareBulk,
  importSettingsSchema,
} from "../src/server/catalog/content-plans";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  url.pathname !== "/hker_directory_test" ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  process.env.ALLOW_DIRECTORY_TEST_RESET !== "1"
)
  throw new Error("Isolated loopback test DB required");
async function main() {
  const suffix = Date.now();
  const source =
    "name,slug,shortDescription\n" +
    Array.from(
      { length: 200 },
      (_, i) =>
        `虛構效能測試 ${i},benchmark-${suffix}-${i},${"中文描述".repeat(40)}`,
    ).join("\n");
  const start = performance.now();
  const plan = await prepareImport(source, importSettingsSchema.parse({}), 1);
  const preview = performance.now();
  const result = await commitContentPlan(plan.id, plan.digest, 1);
  const commit = performance.now();
  const affected = result.affected as { id: number; revision: number }[];
  const bulk = await prepareBulk(
    {
      entries: affected,
      patch: { featured: true, addTags: [], removeTags: [] },
    },
    1,
  );
  const bulkPreview = performance.now();
  await commitContentPlan(bulk.id, bulk.digest, 1);
  const end = performance.now();
  // Separate synthetic keys allow cleanup without touching browser fixtures.
  const metricPrefix = `benchmark-${suffix}-`;
  await db.execute(sql`insert into directory_event_days(day,source,kind,key,count,zero_count)
    select current_date - d, s, 'search', ${metricPrefix} || k, 10, 2
    from generate_series(0,89) d cross join generate_series(1,50) k
    cross join (values ('web'),('bot')) sources(s)`);
  const reportSamples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const reportStart = performance.now();
    const report = await analyticsReport(
      "2020-01-01",
      "2030-01-01",
      i % 2 ? "web" : "all",
    );
    if (report.collection.status !== "enabled")
      throw new Error("Report degraded");
    reportSamples.push(performance.now() - reportStart);
  }
  reportSamples.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        database: "loopback PostgreSQL 16 synthetic test",
      },
      dataset: { rows: 200, bytes: Buffer.byteLength(source), concurrency: 1 },
      errors: 0,
      analytics: {
        syntheticRows: 9000,
        samples: 20,
        concurrency: 1,
        medianMs: reportSamples[10],
        p95Ms: reportSamples[18],
      },
      processMemoryBytes: process.memoryUsage(),
      milliseconds: {
        preview: preview - start,
        commit: commit - preview,
        bulkPreview: bulkPreview - commit,
        bulkCommit: end - bulkPreview,
      },
    }),
  );
  await db.execute(
    sql`delete from directory_listings where slug like ${`benchmark-${suffix}-%`}`,
  );
  await db.execute(
    sql`delete from directory_event_days where key like ${`${metricPrefix}%`}`,
  );
}
main()
  .catch(() => {
    console.error("Phase 8 benchmark failed");
    process.exitCode = 1;
  })
  .finally(closeDatabase);
