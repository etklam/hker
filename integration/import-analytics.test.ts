import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { catalogEventDays, catalogEventReceipts } from "@/db/schema/directoryOperations";
import { previewImport, confirmImport } from "@/server/catalog/import";
import { analyticsReport, cleanupAnalytics, enabledOutboundLink, privateQueryKey, recordCatalogEvent } from "@/server/catalog/analytics";
import { CatalogSearchService, saveListing, saveTaxonomy } from "@/server/catalog/service";

if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test")) throw new Error("Use isolated hker_directory_test only");
const csv = (headers: string[], rows: unknown[][]) => [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
let importSequence = 0;
const importOptions = () => ({
  actorId: 1,
  requestKey: `integration-import-${++importSequence}`,
});
beforeAll(async () => {
  await db.execute(sql`truncate directory_import_jobs, directory_event_days, directory_event_receipts, directory_listings, directory_categories, directory_areas, directory_tags, directory_tag_groups, directory_navigation_presets restart identity cascade`);
});
describe("directory import and analytics acceptance", () => {
  it("maps taxonomy, multiple typed links, aliases and public attributes; generates safe unique Chinese slugs", async () => {
    const category = await saveTaxonomy("categories", { name: "匯入分類", slug: "import-category" });
    const area = await saveTaxonomy("areas", { name: "匯入地區", slug: "import-area" });
    const tag = await saveTaxonomy("tags", { name: "匯入標籤", slug: "import-tag" });
    const text = csv(["name", "category", "area", "tags", "links", "aliases", "attrs"], [["中文店", category.slug, area.name, tag.slug, JSON.stringify([{ type: "website", label: "網站", url: "https://example.test/Case#section" }, { type: "phone", label: "電話", url: "tel:+85212345678" }]), '["別名"]', '{"營業時間":"10–18"}']]);
    const preview = await previewImport(text);
    expect(preview.valid).toBe(true);
    const result = await confirmImport(text, preview.digest, importOptions());
    const row = (await CatalogSearchService.detail(preview.items[0].slug, "admin"))!;
    expect(result.imported).toBe(1);
    expect(row).toMatchObject({ categoryId: category.id, areaId: area.id, aliases: ["別名"], attrs: { 營業時間: "10–18" }, enabled: false });
    expect(row.links.map(link => link.url)).toEqual(["https://example.test/Case#section", "tel:+85212345678"]);
    expect(row.tags.map(value => value.id)).toEqual([tag.id]);
    const repeated = await previewImport(text);
    expect(repeated.items[0].slug).not.toBe(row.slug);
    expect(repeated.items[0].warnings.length).toBeGreaterThan(0);
  });
  it("reports ambiguous names and hard slug conflicts without committing a valid sibling row", async () => {
    await saveTaxonomy("categories", { name: "同名", slug: "ambiguous-a" });
    await saveTaxonomy("categories", { name: "同名", slug: "ambiguous-b" });
    const text = csv(["name", "slug", "category"], [["錯誤", "invalid-import", "同名"], ["有效", "valid-sibling", ""]]);
    const preview = await previewImport(text);
    expect(preview.valid).toBe(false);
    expect(preview.items[0].errors.join(" ")).toContain("不唯一");
    await expect(confirmImport(text, preview.digest, importOptions())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await CatalogSearchService.detail("valid-sibling", "admin")).toBeNull();
    const duplicate = await previewImport(csv(["name", "slug"], [["甲", "same-slug"], ["乙", "same-slug"]]));
    expect(duplicate.items[1].errors).toContain("網址代稱已存在");
  });
  it("requires explicit warning decisions, permits skip and replays a lost response idempotently", async () => {
    await saveListing({ name: "分店", slug: "existing-branch", links: [{ type: "website", label: "網站", url: "https://branches.test/A#one" }] });
    const text = csv(["name", "slug", "website"], [["分店", "new-branch", "https://branches.test/A#one"], ["分店", "skipped-branch", ""]]);
    const preview = await previewImport(text);
    expect(preview.valid).toBe(true);
    await expect(confirmImport(text, preview.digest, importOptions())).rejects.toMatchObject({ code: "CONFLICT" });
    const actorScoped = {
      actorId: 1,
      requestKey: "actor-scoped",
      decisions: { "2": "skip", "3": "skip" },
    } as const;
    expect(await confirmImport(text, preview.digest, actorScoped)).toMatchObject({ replayed: false, imported: 0 });
    expect(await confirmImport(text, preview.digest, { ...actorScoped, actorId: 2 })).toMatchObject({ replayed: false, imported: 0 });
    expect(await confirmImport(text, preview.digest, actorScoped)).toMatchObject({ replayed: true, imported: 0 });
    const options = { actorId: 1, requestKey: "lost-response", decisions: { "2": "accept", "3": "skip" } } as const;
    const result = await confirmImport(text, preview.digest, options);
    expect(result).toMatchObject({ imported: 1, skipped: 1, replayed: false });
    expect(await confirmImport(text, preview.digest, options)).toMatchObject({ ids: result.ids, replayed: true });
    await expect(confirmImport(text, preview.digest, { ...options, decisions: { "2": "skip", "3": "skip" } })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await CatalogSearchService.detail("skipped-branch", "admin")).toBeNull();
  });
  it("serializes simultaneous confirmations and revalidates changed taxonomy before commit", async () => {
    const text = csv(["name", "slug"], [["並行", "import-concurrent"]]);
    const preview = await previewImport(text);
    const options = importOptions();
    const results = await Promise.all([confirmImport(text, preview.digest, options), confirmImport(text, preview.digest, options)]);
    expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
    expect(results[0].ids).toEqual(results[1].ids);
    const tag = await saveTaxonomy("tags", { name: "會改變", slug: "changes-before-import" });
    const changed = csv(["name", "slug", "tags"], [["待匯入", "changed-import", tag.slug]]);
    const initial = await previewImport(changed);
    await saveTaxonomy("tags", { name: "會改變", slug: tag.slug, enabled: false }, tag.id);
    await expect(confirmImport(changed, initial.digest, importOptions())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await CatalogSearchService.detail("changed-import", "admin")).toBeNull();
  });
  it("deduplicates logical events, redacts sensitive queries, and labels reports", async () => {
    const tag = await saveTaxonomy("tags", { name: "統計標籤", slug: "analytics-label" });
    const event = { kind: "search", source: "web", key: "維修", actionId: "same-action", zeroResult: true } as const;
    await Promise.all([recordCatalogEvent(event), recordCatalogEvent(event)]);
    await recordCatalogEvent({ ...event, key: "person@example.com", actionId: "private" });
    await recordCatalogEvent({ kind: "tag", source: "web", key: String(tag.id), actionId: "tag-action" });
    const report = await analyticsReport("2000-01-01", "2100-01-01");
    expect(report.rows.find(row => row.key === "維修")).toMatchObject({ count: 1, zeroCount: 1 });
    expect(report.rows.find(row => row.kind === "tag")?.label).toBe("統計標籤");
    expect(report.rows.some(row => row.key.includes("@"))).toBe(false);
    expect(privateQueryKey("電話 91234567")).toBeNull();
  });
  it("bounds concurrent daily cardinality and retains active data during cleanup", async () => {
    await db.execute(sql`insert into directory_event_days(day,source,kind,key,count,zero_count) select current_date,'web','search','seed-' || n,1,0 from generate_series(1,1998) n on conflict do nothing`);
    await Promise.all(Array.from({ length: 20 }, (_, index) => recordCatalogEvent({ kind: "search", source: "web", key: `獨特搜尋${String.fromCharCode(65 + index)}`, actionId: `cap-${index}` })));
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(catalogEventDays);
    expect(count).toBeLessThanOrEqual(2001);
    await db.insert(catalogEventDays).values({ day: "2000-01-01", source: "web", kind: "search", key: "expired", count: 1 });
    await db.insert(catalogEventReceipts).values({ id: "expired", createdAt: new Date("2000-01-01") });
    await cleanupAnalytics();
    expect(await db.select().from(catalogEventReceipts).where(eq(catalogEventReceipts.id, "expired"))).toHaveLength(0);
    expect(await db.select().from(catalogEventDays).where(eq(catalogEventDays.key, "expired"))).toHaveLength(0);
    expect(await db.select().from(catalogEventDays).where(eq(catalogEventDays.key, "維修"))).toHaveLength(1);
  });
  it("rolls back failed metric savepoints without aborting discovery transactions", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await db.transaction(async tx => {
        await tx.execute(sql`create temporary table directory_event_receipts(id text primary key, impossible text not null) on commit drop`);
        await recordCatalogEvent({ kind: "search", source: "bot", key: "安全搜尋", actionId: "failed-metric" }, tx);
        const result = await tx.execute(sql`select 1 as alive`);
        expect(result[0].alive).toBe(1);
      });
      expect(warning).toHaveBeenCalledWith("Catalog metrics unavailable");
    } finally { warning.mockRestore(); }
  });
  it("resolves stored outbound IDs only while both listing and link are enabled", async () => {
    const row = await saveListing({ name: "出站", slug: "outbound-acceptance", enabled: true, links: [{ type: "website", label: "公開", url: "https://outbound.test/Exact#path" }, { type: "website", label: "隱藏", url: "https://hidden.test", enabled: false }] });
    const detail = (await CatalogSearchService.detail(row.slug, "admin"))!;
    expect(await enabledOutboundLink(detail.links[0].id)).toMatchObject({ url: "https://outbound.test/Exact#path" });
    expect(await enabledOutboundLink(detail.links[1].id)).toBeNull();
    await saveListing({ ...detail, enabled: false }, row.id);
    expect(await enabledOutboundLink(detail.links[0].id)).toBeNull();
  });
});
