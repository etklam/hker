import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  catalogEventDays,
  catalogEventReceipts,
} from "@/db/schema/directoryOperations";
import {
  analyticsReport,
  cleanupAnalytics,
  deleteStoredQuery,
  hongKongDay,
  issueCatalogEventReceipt,
  issueCatalogSearchObservation,
  recordCatalogEvent,
  verifyCatalogEventReceipt,
  verifyCatalogSearchObservation,
} from "@/server/catalog/analytics";
import {
  CatalogSearchService,
  saveListing,
  saveTaxonomy,
} from "@/server/catalog/service";

if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test"))
  throw new Error("Use isolated hker_directory_test only");

const originalSecret = process.env.ANALYTICS_ACTION_SECRET;
const originalEnabled = process.env.DIRECTORY_ANALYTICS_ENABLED;
const at = new Date("2026-09-27T16:30:00.000Z");

beforeAll(() => {
  process.env.ANALYTICS_ACTION_SECRET = "phase8-isolated-analytics-secret";
  process.env.DIRECTORY_ANALYTICS_ENABLED = "true";
});
beforeEach(async () => {
  await db.execute(
    sql`delete from directory_event_days; delete from directory_event_receipts`,
  );
});
afterAll(() => {
  if (originalSecret === undefined) delete process.env.ANALYTICS_ACTION_SECRET;
  else process.env.ANALYTICS_ACTION_SECRET = originalSecret;
  if (originalEnabled === undefined)
    delete process.env.DIRECTORY_ANALYTICS_ENABLED;
  else process.env.DIRECTORY_ANALYTICS_ENABLED = originalEnabled;
});

describe("Phase 8 discovery analytics", () => {
  it("uses Hong Kong days, keeps sensitive queries only in totals, and expires actions", async () => {
    expect(hongKongDay(at)).toBe("2026-09-28");
    const receipt = issueCatalogEventReceipt(at)!;
    expect(verifyCatalogEventReceipt(receipt, at)).toBe(true);
    expect(
      verifyCatalogEventReceipt(
        {
          ...receipt,
          occurredAt: new Date(at.getTime() + 1000).toISOString(),
        },
        at,
      ),
    ).toBe(false);
    const sensitive = {
      kind: "search",
      source: "web",
      key: "person@example.com",
      actionId: "private-action",
      occurredAt: at,
      zeroResult: true,
    } as const;
    expect(await recordCatalogEvent(sensitive, db, { now: at })).toBe(
      "recorded",
    );
    expect(await recordCatalogEvent(sensitive, db, { now: at })).toBe(
      "ignored",
    );
    expect(
      await recordCatalogEvent(
        {
          ...sensitive,
          actionId: receipt.actionId,
          occurredAt: receipt.occurredAt,
        },
        db,
        { now: new Date(at.getTime() + 8 * 86400000) },
      ),
    ).toBe("ignored");

    const report = await analyticsReport("2026-09-28", "2026-09-28");
    expect(report.summary).toMatchObject({
      searches: 1,
      zeroResults: 1,
      zeroRate: 1,
      suppressedSearches: 1,
    });
    expect(report.rows).toEqual([
      expect.objectContaining({ key: "[已隱藏]", count: 1 }),
    ]);
    expect(JSON.stringify(report)).not.toContain("person@example.com");
    const receipts = await db.select().from(catalogEventReceipts);
    expect(receipts[0].id).not.toContain("private-action");
  });

  it("records the authoritative observation across later publication changes and replays", async () => {
    const suffix = Date.now()
      .toString(36)
      .replace(/\d/g, (digit) => String.fromCharCode(97 + Number(digit)));
    const zeroInput = { query: `觀測前零結果${suffix}`, pageSize: 1 };
    const zeroResult = await CatalogSearchService.search(zeroInput);
    expect(zeroResult.total).toBe(0);
    const zeroObservation = issueCatalogSearchObservation(
      "search",
      zeroInput.query,
      zeroInput,
      zeroResult.total,
      at,
    )!;
    await saveListing({
      name: zeroInput.query,
      slug: `rc-observation-published-${suffix}`,
      enabled: true,
    });
    expect((await CatalogSearchService.search(zeroInput)).total).toBe(1);
    expect(
      verifyCatalogSearchObservation(
        zeroObservation,
        "search",
        zeroInput.query,
        zeroInput,
        at,
      ),
    ).toBe(true);

    const replayStatuses = await Promise.all(
      Array.from({ length: 10 }, () =>
        recordCatalogEvent(
          {
            kind: "search",
            source: "web",
            key: zeroInput.query,
            actionId: zeroObservation.actionId,
            occurredAt: zeroObservation.observedAt,
            zeroResult: zeroObservation.resultCount === 0,
          },
          db,
          { now: at },
        ),
      ),
    );
    expect(
      replayStatuses.filter((status) => status === "recorded"),
    ).toHaveLength(1);

    const present = await saveListing({
      name: `觀測前已有結果${suffix}`,
      slug: `rc-observation-disabled-${suffix}`,
      enabled: true,
    });
    const presentInput = { query: `觀測前已有結果${suffix}`, pageSize: 1 };
    const presentResult = await CatalogSearchService.search(presentInput);
    expect(presentResult.total).toBe(1);
    const presentObservation = issueCatalogSearchObservation(
      "search",
      presentInput.query,
      presentInput,
      presentResult.total,
      at,
    )!;
    await saveListing({ ...present, enabled: false }, present.id);
    expect((await CatalogSearchService.search(presentInput)).total).toBe(0);
    await recordCatalogEvent(
      {
        kind: "search",
        source: "web",
        key: presentInput.query,
        actionId: presentObservation.actionId,
        occurredAt: presentObservation.observedAt,
        zeroResult: presentObservation.resultCount === 0,
      },
      db,
      { now: at },
    );

    const report = await analyticsReport("2026-09-28", "2026-09-28", "web");
    expect(
      report.rows.find((row) => row.key === zeroInput.query),
    ).toMatchObject({
      count: 1,
      zeroCount: 1,
    });
    expect(
      report.rows.find((row) => row.key === presentInput.query),
    ).toMatchObject({ count: 1, zeroCount: 0 });
  });

  it("counts one bounded filter dimension and rejects nonexistent entity dimensions", async () => {
    const tag = await saveTaxonomy("tags", {
      name: `統計標籤 ${Date.now()}`,
      slug: `phase8-analytics-${Date.now()}`,
    });
    expect(
      await recordCatalogEvent(
        {
          kind: "filter",
          source: "web",
          key: "client-controlled",
          actionId: "filter",
          occurredAt: at,
        },
        db,
        { now: at },
      ),
    ).toBe("recorded");
    expect(
      await recordCatalogEvent(
        {
          kind: "tag",
          source: "web",
          key: String(tag.id),
          actionId: "valid-tag",
          occurredAt: at,
        },
        db,
        { now: at },
      ),
    ).toBe("recorded");
    expect(
      await recordCatalogEvent(
        {
          kind: "tag",
          source: "web",
          key: "2147483647",
          actionId: "forged-tag",
          occurredAt: at,
        },
        db,
        { now: at },
      ),
    ).toBe("ignored");
    const report = await analyticsReport("2026-09-28", "2026-09-28", "web");
    expect(report.summary.filteredDiscoveries).toBe(1);
    expect(report.rows.find((row) => row.kind === "filter")?.key).toBe(
      "applied",
    );
    expect(report.rows.some((row) => row.key === "2147483647")).toBe(false);
  });

  it("rejects a preset whose shared resolver marks its criteria unavailable", async () => {
    const suffix = Date.now();
    const category = await saveTaxonomy("categories", {
      name: `統計分類 ${suffix}`,
      slug: `phase8-preset-category-${suffix}`,
    });
    const preset = await saveTaxonomy("navigation", {
      label: `統計導覽 ${suffix}`,
      placement: "public",
      categoryId: category.id,
      tagIds: [],
      enabled: true,
    });
    await saveTaxonomy(
      "categories",
      {
        name: category.name,
        slug: category.slug,
        enabled: false,
      },
      category.id,
    );

    expect(
      await recordCatalogEvent(
        {
          kind: "preset",
          source: "web",
          key: String(preset.id),
          actionId: "unavailable-preset",
          occurredAt: at,
        },
        db,
        { now: at },
      ),
    ).toBe("ignored");
    expect(
      (await analyticsReport("2026-09-28", "2026-09-28", "web")).rows,
    ).toHaveLength(0);
  });

  it("lets an administrator service delete an eligible stored query label", async () => {
    await recordCatalogEvent(
      {
        kind: "search",
        source: "web",
        key: "需要移除",
        actionId: "remove-me",
        occurredAt: at,
      },
      db,
      { now: at },
    );
    expect(await deleteStoredQuery(" 需要移除 ")).toBe(1);
    expect(
      await db
        .select()
        .from(catalogEventDays)
        .where(eq(catalogEventDays.key, "需要移除")),
    ).toHaveLength(0);
    expect(await deleteStoredQuery("person@example.com")).toBe(0);
  });

  it("reports disablement and cleans a bounded batch with an injected clock", async () => {
    process.env.DIRECTORY_ANALYTICS_ENABLED = "false";
    expect(
      await recordCatalogEvent(
        {
          kind: "search",
          source: "web",
          key: "維修",
          actionId: "disabled",
          occurredAt: at,
        },
        db,
        { now: at },
      ),
    ).toBe("disabled");
    expect(
      (await analyticsReport("2026-01-01", "2026-12-31")).collection.status,
    ).toBe("disabled");
    process.env.DIRECTORY_ANALYTICS_ENABLED = "true";

    await db.insert(catalogEventDays).values([
      {
        day: "2000-01-01",
        source: "web",
        kind: "search",
        key: "old-a",
        count: 1,
      },
      {
        day: "2000-01-02",
        source: "web",
        kind: "search",
        key: "old-b",
        count: 1,
      },
    ]);
    await db.insert(catalogEventReceipts).values([
      { id: "old-a", createdAt: new Date("2000-01-01") },
      { id: "old-b", createdAt: new Date("2000-01-02") },
    ]);
    expect(await cleanupAnalytics(db, { now: at, batchSize: 1 })).toEqual({
      aggregates: 1,
      receipts: 1,
    });
    expect(
      await db
        .select()
        .from(catalogEventDays)
        .where(eq(catalogEventDays.day, "2000-01-01")),
    ).toHaveLength(0);
    expect(await db.select().from(catalogEventDays)).toHaveLength(1);
    expect(await db.select().from(catalogEventReceipts)).toHaveLength(1);
  });
});
