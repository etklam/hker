import os from "node:os";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as directory from "../src/db/schema/directory";
import * as operations from "../src/db/schema/directoryOperations";
import { closeDatabase } from "../src/server/db";
import {
  buildSearchWhere,
  CatalogSearchService,
  type CatalogExecutor,
} from "../src/server/catalog/service";
import { searchSchema, type SearchInput } from "../src/schemas/directory";

const LISTING_COUNT = boundedInteger("HKER_BENCHMARK_LISTINGS", 3_000, 1_000, 10_000);
const SAMPLE_COUNT = boundedInteger("HKER_BENCHMARK_SAMPLES", 30, 20, 200);
const CONCURRENCY = boundedInteger("HKER_BENCHMARK_CONCURRENCY", 8, 2, 20);
const CONCURRENT_OPERATIONS = boundedInteger(
  "HKER_BENCHMARK_CONCURRENT_OPERATIONS",
  48,
  CONCURRENCY,
  500,
);
const RUN = `perfbench-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

function benchmarkUrl() {
  if (Number(process.versions.node.split(".")[0]) !== 24)
    throw new Error("Catalog benchmark requires Node.js 24");
  if (process.env.HKER_BENCHMARK_ALLOW_WRITE !== "1")
    throw new Error("Set HKER_BENCHMARK_ALLOW_WRITE=1 to permit synthetic writes");
  const value = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    !["postgres:", "postgresql:"].includes(value.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(value.hostname) ||
    value.pathname !== "/hker_directory_test"
  ) {
    throw new Error(
      "Benchmark requires a loopback PostgreSQL URL for the disposable hker_directory_test database",
    );
  }
  return value.toString();
}

let queryCount = 0;
const client = postgres(benchmarkUrl(), {
  max: Math.min(20, CONCURRENCY + 2),
  idle_timeout: 30,
  connect_timeout: 10,
});
const benchmarkDb = drizzle(client, {
  schema: { ...directory, ...operations },
  logger: { logQuery: () => queryCount++ },
});
// The benchmark schema is a deliberate subset; measured service methods use only catalog tables.
const catalogExecutor = benchmarkDb as unknown as CatalogExecutor;

type Scenario = { name: string; run: () => Promise<unknown> };
type Observation = { milliseconds: number; queries: number; error?: string };

async function insertBatches<T>(
  values: T[],
  size: number,
  insert: (batch: T[]) => Promise<unknown>,
) {
  for (let offset = 0; offset < values.length; offset += size)
    await insert(values.slice(offset, offset + size));
}

async function seed() {
  const categories = await benchmarkDb
    .insert(directory.categories)
    .values(
      Array.from({ length: 20 }, (_, index) => ({
        name: `${RUN} 分類 ${index}`,
        slug: `${RUN}-category-${index}`,
        enabled: index !== 19,
        sortOrder: index,
      })),
    )
    .returning({ id: directory.categories.id });
  const groups = await benchmarkDb
    .insert(directory.tagGroups)
    .values(
      Array.from({ length: 12 }, (_, index) => ({
        name: `${RUN} 標籤群組 ${index}`,
        slug: `${RUN}-group-${index}`,
        enabled: index !== 11,
        sortOrder: index,
      })),
    )
    .returning({ id: directory.tagGroups.id });
  const tags = await benchmarkDb
    .insert(directory.tags)
    .values(
      Array.from({ length: 240 }, (_, index) => ({
        name: `${RUN} 標籤 ${index}`,
        slug: `${RUN}-tag-${index}`,
        groupId: groups[index % groups.length].id,
        enabled: index < 220,
        publicVisible: index % 31 !== 30,
        botVisible: index % 29 !== 28,
        filterable: index % 37 !== 36,
        botFeatured: index < 12,
        sortOrder: index,
      })),
    )
    .returning({ id: directory.tags.id });
  await benchmarkDb.insert(directory.tagAliases).values(
    tags.map((tag, index) => ({
      tagId: tag.id,
      alias: index === 5 ? "週末維修" : `${RUN} 別名 ${index}`,
    })),
  );

  const areas: { id: number; rootId: number }[] = [];
  for (let root = 0; root < 8; root++) {
    let parentId: number | null = null;
    let rootId = 0;
    for (let depth = 0; depth < 6; depth++) {
      const inserted: { id: number }[] = await benchmarkDb
        .insert(directory.areas)
        .values({
          name: `${RUN} 地區 ${root}-${depth}`,
          slug: `${RUN}-area-${root}-${depth}`,
          parentId,
          enabled: root !== 7,
          sortOrder: root * 10 + depth,
        })
        .returning({ id: directory.areas.id });
      const area = inserted[0];
      rootId ||= area.id;
      areas.push({ id: area.id, rootId });
      parentId = area.id;
    }
  }

  const listingValues = Array.from({ length: LISTING_COUNT }, (_, index) => {
    const price = index % 4;
    return {
      name:
        index % 40 === 0
          ? `${RUN} 港式維修服務 ${index}`
          : `${RUN} 商戶 ${index}`,
      slug: `${RUN}-listing-${index}`,
      aliases: index % 41 === 0 ? ["香港修理", `${RUN} 商號別名 ${index}`] : [],
      shortDescription: index % 40 === 0 ? "社區港式維修" : "香港社區服務",
      description: `合成效能資料 ${RUN} ${index}，只供隔離測量。`,
      categoryId: categories[index % categories.length].id,
      areaId: areas[index % areas.length].id,
      priceMin: price === 0 || price === 3 ? null : price === 1 ? "100.00" : "600.00",
      priceMax: price === 0 || price === 2 ? null : price === 1 ? "500.00" : "300.00",
      priceCurrency: index % 17 === 0 ? "USD" : "HKD",
      attrs: { hours: "10:00-18:00", syntheticRun: RUN },
      featured: index % 10 === 0,
      sortOrder: index,
      enabled: index % 23 !== 22,
    };
  });
  const listingRows: { id: number; slug: string }[] = [];
  await insertBatches(listingValues, 250, async (batch) => {
    listingRows.push(
      ...(await benchmarkDb
        .insert(directory.listings)
        .values(batch)
        .returning({ id: directory.listings.id, slug: directory.listings.slug })),
    );
  });
  await insertBatches(
    listingRows.flatMap((listing, index) => [
      {
        listingId: listing.id,
        type: "website",
        label: "網站",
        url: `https://example.invalid/${RUN}/${index}`,
        sortOrder: 0,
      },
      {
        listingId: listing.id,
        type: "telegram",
        label: "Telegram",
        url: `https://t.me/${RUN.replaceAll("-", "_")}_${index}`,
        sortOrder: 1,
        enabled: index % 43 !== 42,
      },
    ]),
    500,
    (batch) => benchmarkDb.insert(directory.listingLinks).values(batch),
  );
  await insertBatches(
    listingRows.flatMap((listing, index) => {
      const chosen = [tags[index % 200].id, tags[(index * 7 + 1) % 200].id, tags[5].id];
      return [...new Set(chosen)].map((tagId) => ({ listingId: listing.id, tagId }));
    }),
    1_000,
    (batch) => benchmarkDb.insert(directory.listingTags).values(batch),
  );
  await benchmarkDb.execute(
    sql`analyze directory_listings, directory_listing_links, directory_listing_tags, directory_tags, directory_tag_aliases, directory_categories, directory_areas`,
  );
  return { categories, groups, tags, areas, listings: listingRows };
}

async function cleanup() {
  await benchmarkDb
    .delete(directory.listings)
    .where(sql`${directory.listings.slug} like ${`${RUN}-%`}`);
  await benchmarkDb
    .delete(directory.tags)
    .where(sql`${directory.tags.slug} like ${`${RUN}-%`}`);
  await benchmarkDb
    .delete(directory.tagGroups)
    .where(sql`${directory.tagGroups.slug} like ${`${RUN}-%`}`);
  while (true) {
    const deleted = await benchmarkDb.execute(sql`
      delete from directory_areas
      where slug like ${`${RUN}-%`}
        and id not in (select parent_id from directory_areas where parent_id is not null)
      returning id
    `);
    if (!deleted.length) break;
  }
  await benchmarkDb
    .delete(directory.categories)
    .where(sql`${directory.categories.slug} like ${`${RUN}-%`}`);
}

async function observe(run: () => Promise<unknown>): Promise<Observation> {
  queryCount = 0;
  const started = performance.now();
  try {
    await run();
    return { milliseconds: performance.now() - started, queries: queryCount };
  } catch (error) {
    return {
      milliseconds: performance.now() - started,
      queries: queryCount,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function distribution(samples: Observation[]) {
  const values = samples.map((sample) => sample.milliseconds).sort((a, b) => a - b);
  const percentile = (ratio: number) => values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
  const queries = samples.map((sample) => sample.queries);
  return {
    samples: samples.length,
    errors: samples.filter((sample) => sample.error).map((sample) => sample.error),
    latencyMs: {
      min: Number(values[0].toFixed(2)),
      mean: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
      p50: Number(percentile(0.5).toFixed(2)),
      p95: Number(percentile(0.95).toFixed(2)),
      p99: Number(percentile(0.99).toFixed(2)),
      max: Number(values.at(-1)!.toFixed(2)),
    },
    queryCount: {
      min: Math.min(...queries),
      max: Math.max(...queries),
      mean: Number((queries.reduce((sum, value) => sum + value, 0) / queries.length).toFixed(2)),
    },
  };
}

function planSummary(value: unknown) {
  const result = value as { "Planning Time"?: number; "Execution Time"?: number; Plan?: Record<string, unknown> }[];
  const root = result[0] ?? {};
  const nodes: Record<string, unknown>[] = [];
  const visit = (node: Record<string, unknown> | undefined) => {
    if (!node) return;
    nodes.push({
      node: node["Node Type"],
      relation: node["Relation Name"] ?? null,
      index: node["Index Name"] ?? null,
      rows: node["Actual Rows"],
      loops: node["Actual Loops"],
      sharedHitBlocks: node["Shared Hit Blocks"] ?? 0,
      sharedReadBlocks: node["Shared Read Blocks"] ?? 0,
      tempReadBlocks: node["Temp Read Blocks"] ?? 0,
      tempWrittenBlocks: node["Temp Written Blocks"] ?? 0,
      sortMethod: node["Sort Method"] ?? null,
      sortSpaceKb: node["Sort Space Used"] ?? null,
    });
    for (const child of (node.Plans as Record<string, unknown>[] | undefined) ?? []) visit(child);
  };
  visit(root.Plan);
  return {
    planningMs: root["Planning Time"],
    executionMs: root["Execution Time"],
    nodes,
  };
}

async function explain(name: string, raw: SearchInput, audience: "public" | "admin") {
  const input = searchSchema.parse(raw);
  const where = and(
    buildSearchWhere(input, audience),
    input.sort.startsWith("price-") ? eq(directory.listings.priceCurrency, "HKD") : undefined,
  )!;
  const result = await benchmarkDb.execute(sql`
    explain (analyze, buffers, format json)
    select ${directory.listings.id}
    from ${directory.listings}
    where ${where}
    order by ${directory.listings.sortOrder}, ${directory.listings.id}
    limit ${input.pageSize}
  `);
  return { name, ...planSummary(result[0]?.["QUERY PLAN"]) };
}

async function main() {
  let failed = false;
  try {
    const [postgresInfo] = await benchmarkDb.execute<{
      version: string;
      database: string;
      sharedBuffers: string;
      maxConnections: string;
    }>(sql`
      select version() as version, current_database() as database,
        current_setting('shared_buffers') as "sharedBuffers",
        current_setting('max_connections') as "maxConnections"
    `);
    const fixture = await seed();
    const memoryBeforeMeasurements = process.memoryUsage();
    const botPlan = async () => {
      const result = await CatalogSearchService.search(
        { query: "港式維修", pageSize: 4 },
        "bot",
        catalogExecutor,
      );
      return result.items.map((item) => ({
        slug: item.slug,
        text: [item.name, item.area?.name, item.category?.name, item.shortDescription]
          .filter(Boolean)
          .join("\n"),
        links: item.links.slice(0, 2).map((link) => link.url),
      }));
    };
    const scenarios: Scenario[] = [
      { name: "homepage-featured", run: () => CatalogSearchService.search({ featured: true, pageSize: 12 }, "public", catalogExecutor) },
      { name: "empty-browse", run: () => CatalogSearchService.search({ pageSize: 12 }, "public", catalogExecutor) },
      { name: "chinese-name-search", run: () => CatalogSearchService.search({ query: "港式維修", pageSize: 12 }, "public", catalogExecutor) },
      { name: "tag-alias-search", run: () => CatalogSearchService.search({ query: "週末維修", pageSize: 12 }, "public", catalogExecutor) },
      { name: "multi-tag-and", run: () => CatalogSearchService.search({ tagIds: [fixture.tags[1].id, fixture.tags[5].id], tagMatchMode: "and", pageSize: 12 }, "public", catalogExecutor) },
      { name: "multi-tag-or", run: () => CatalogSearchService.search({ tagIds: [fixture.tags[1].id, fixture.tags[5].id], tagMatchMode: "or", pageSize: 12 }, "public", catalogExecutor) },
      { name: "parent-area", run: () => CatalogSearchService.search({ areaId: fixture.areas[0].rootId, pageSize: 12 }, "public", catalogExecutor) },
      { name: "bounded-price", run: () => CatalogSearchService.search({ priceMin: 200, priceMax: 700, pageSize: 12 }, "public", catalogExecutor) },
      { name: "detail", run: () => CatalogSearchService.detail(fixture.listings[Math.floor(LISTING_COUNT / 2)].slug, "public", catalogExecutor) },
      { name: "admin-filtered-list", run: () => CatalogSearchService.search({ status: "disabled", query: RUN, pageSize: 50 }, "admin", catalogExecutor) },
      { name: "bot-result-planning", run: botPlan },
    ];

    const cold: Record<string, Observation> = {};
    for (const scenario of scenarios) cold[scenario.name] = await observe(scenario.run);
    const warm: Record<string, ReturnType<typeof distribution>> = {};
    for (const scenario of scenarios) {
      const samples: Observation[] = [];
      for (let index = 0; index < SAMPLE_COUNT; index++) samples.push(await observe(scenario.run));
      warm[scenario.name] = distribution(samples);
    }

    queryCount = 0;
    const concurrentStarted = performance.now();
    const concurrentSamples: Observation[] = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (true) {
          const index = next++;
          if (index >= CONCURRENT_OPERATIONS) return;
          const scenario = scenarios[index % scenarios.length];
          const started = performance.now();
          try {
            await scenario.run();
            concurrentSamples.push({ milliseconds: performance.now() - started, queries: 0 });
          } catch (error) {
            concurrentSamples.push({
              milliseconds: performance.now() - started,
              queries: 0,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }),
    );
    const concurrentQueries = queryCount;

    const explains = await Promise.all([
      explain("empty-browse", { pageSize: 12 }, "public"),
      explain("chinese-name-search", { query: "港式維修", pageSize: 12 }, "public"),
      explain("tag-alias-search", { query: "週末維修", pageSize: 12 }, "public"),
      explain("multi-tag-and", { tagIds: [fixture.tags[1].id, fixture.tags[5].id], tagMatchMode: "and", pageSize: 12 }, "public"),
      explain("parent-area", { areaId: fixture.areas[0].rootId, pageSize: 12 }, "public"),
      explain("bounded-price", { priceMin: 200, priceMax: 700, pageSize: 12 }, "public"),
      explain("admin-filtered-list", { status: "disabled", query: RUN, pageSize: 50 }, "admin"),
    ]);

    failed =
      Object.values(cold).some((sample) => sample.error) ||
      Object.values(warm).some((summary) => summary.errors.length) ||
      concurrentSamples.some((sample) => sample.error);
    console.log(
      JSON.stringify(
        {
          label: "exploratory isolated benchmark; not a production-capacity claim",
          run: RUN,
          recordedAt: new Date().toISOString(),
          runtime: {
            node: process.version,
            platform: `${os.platform()} ${os.release()} ${os.arch()}`,
            cpu: os.cpus()[0]?.model,
            logicalCpuCount: os.cpus().length,
            totalMemoryBytes: os.totalmem(),
            postgres: postgresInfo,
            processMemoryBeforeMeasurements: memoryBeforeMeasurements,
            processMemoryAfterMeasurements: process.memoryUsage(),
          },
          dataset: {
            listings: LISTING_COUNT,
            categories: fixture.categories.length,
            areas: fixture.areas.length,
            areaDepth: 6,
            tagGroups: fixture.groups.length,
            tags: fixture.tags.length,
            aliases: fixture.tags.length,
            links: LISTING_COUNT * 2,
            listingTagRelations: "up to three per listing",
            includes: ["disabled listings", "hidden taxonomy", "missing and bounded prices", "non-HKD prices"],
          },
          conditions: {
            cold: "first call in this process; operating-system and PostgreSQL caches were not flushed",
            warm: `${SAMPLE_COUNT} serial samples per path after the first call`,
            concurrent: `${CONCURRENCY} concurrent clients, ${CONCURRENT_OPERATIONS} mixed operations`,
            queryCount: "Drizzle statements issued by the measured service path",
            bot: "Bot-audience result query/hydration and in-memory result planning; excludes taxonomy, session and delivery-journal work",
          },
          cold,
          warm,
          concurrent: {
            ...distribution(concurrentSamples),
            workers: CONCURRENCY,
            wallClockMs: Number((performance.now() - concurrentStarted).toFixed(2)),
            totalQueries: concurrentQueries,
            queriesPerOperation: Number((concurrentQueries / concurrentSamples.length).toFixed(2)),
          },
          explains,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup().catch((error) => {
      failed = true;
      console.error("Benchmark namespace cleanup failed", error);
    });
    await Promise.allSettled([client.end({ timeout: 5 }), closeDatabase()]);
  }
  if (failed) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
