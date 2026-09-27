import { setPublication } from "@/server/catalog/admin";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { CatalogSearchService as catalog, saveListing, saveTaxonomy, deleteTaxonomy, getTaxonomy, getTaxonomyImpact } from "@/server/catalog/service";
import { listingSchema } from "@/schemas/directory";

if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test")) throw new Error("Use isolated hker_directory_test only");
beforeAll(async () => {
  await db.execute(sql`truncate directory_listings, directory_categories, directory_areas, directory_tags, directory_tag_groups, directory_navigation_presets restart identity cascade`);
});
describe("catalog integrity", () => {
  it("retains link identities, conflicts stale drafts, and reserves old public slugs", async () => {
    const created = await saveListing({ name: "修理", slug: "hardening-original", enabled: true, links: [{ type: "website", label: "網站", url: "https://example.test/A#x" }] });
    const detail = (await catalog.detail(created.slug, "admin"))!;
    const draft = listingSchema.parse(detail);
    const updated = await saveListing({ ...draft, slug: "hardening-renamed" }, created.id);
    expect((await catalog.detail(created.slug))?.slug).toBe(updated.slug);
    expect((await catalog.detail(updated.slug))?.links[0].id).toBe(detail.links[0].id);
    await expect(saveListing(draft, created.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(saveListing({ name: "另一店", slug: created.slug })).rejects.toMatchObject({ code: "CONFLICT" });
    const other = await saveListing({ name: "另一店", slug: "hardening-other" });
    await expect(saveListing({ name: other.name, slug: other.slug, revision: other.revision, links: draft.links }, other.id)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
  it("rejects referenced taxonomy without broadening presets", async () => {
    const tag = await saveTaxonomy("tags", { name: "相依", slug: "hardening-dependent" });
    const preset = await saveTaxonomy("navigation", { label: "相依篩選", tagIds: [tag.id] });
    await expect(deleteTaxonomy("tags", tag.id)).rejects.toMatchObject({ code: "CONFLICT", impact: { presets: 1 } });
    expect((await getTaxonomy("admin")).navigation.find(p => p.id === preset.id)?.tagIds).toEqual([tag.id]);
  });
  it("ranks exact Chinese name then independent aliases before partial names for both audiences", async () => {
    const partial = await saveListing({ name: "香港茶餐廳分店", slug: "hardening-partial", sortOrder: -20, enabled: true });
    const alias = await saveListing({ name: "另一名稱", aliases: ["香港茶餐廳"], slug: "hardening-alias", enabled: true });
    const exact = await saveListing({ name: "香港茶餐廳", slug: "hardening-exact", enabled: true });
    const web = await catalog.search({ query: "香港茶餐廳" });
    expect(web.items.map(i => i.id)).toEqual([exact.id, alias.id, partial.id]);
    expect((await catalog.search({ query: "香港茶餐廳" }, "bot")).items.map(i => i.id)).toEqual(web.items.map(i => i.id));
  });
  it("normalizes Unicode width, case and repeated whitespace without changing display text", async () => {
    const row = await saveListing({ name: "ＦＯＯ   BAR", slug: "hardening-normalized", enabled: true });
    const result = await catalog.search({ query: "foo bar" });
    expect(result.items[0]?.id).toBe(row.id);
    expect(result.items[0]?.name).toBe("ＦＯＯ   BAR");
  });
  it("ranks partial aliases and tag aliases ahead of incidental description matches", async () => {
    const incidental = await saveListing({ name: "雜項", slug: "partial-incidental", description: "週末維修服務", sortOrder: -100, enabled: true });
    const alias = await saveListing({ name: "甲店", slug: "partial-alias", aliases: ["週末維修專門店"], sortOrder: 100, enabled: true });
    const tag = await saveTaxonomy("tags", { name: "特色服務", slug: "partial-tag", aliases: ["週末維修電話"] });
    const tagged = await saveListing({ name: "乙店", slug: "partial-tagged", tagIds: [tag.id], sortOrder: 200, enabled: true });
    expect((await catalog.search({ query: "週末維修" })).items.map(i => i.id)).toEqual([alias.id, tagged.id, incidental.id]);
    expect((await catalog.search({ query: "週末維修", sort: "manual" })).items.map(i => i.id)).toEqual([incidental.id, alias.id, tagged.id]);
    expect((await catalog.search({ query: "週末維修", pageSize: 1, page: 2 })).items[0].id).toBe(tagged.id);
  });
  it("uses only an injected transaction executor and keeps mixed currencies out of HKD sorting", async () => {
    const free = await saveListing({ name: "零價格", slug: "hardening-free", enabled: true, priceMin: 0, priceMax: 0 });
    await saveListing({ name: "外幣", slug: "hardening-foreign", enabled: true, priceMin: 0, priceCurrency: "USD" });
    await db.transaction(async tx => {
      const globalRead = vi.spyOn(db, "select").mockImplementation(() => { throw new Error("Global connection re-entry"); });
      try {
      expect((await catalog.search({ priceMin: 0, priceMax: 0 }, "public", tx)).items.map(i => i.id)).toContain(free.id);
      expect((await catalog.search({ sort: "price-asc" }, "public", tx)).items.every(i => i.priceCurrency === "HKD")).toBe(true);
      expect(await catalog.detail(free.slug, "public", tx)).not.toBeNull();
      expect(await getTaxonomy("public", tx)).toBeDefined();
      } finally { globalRead.mockRestore(); }
    });
  });
});

describe("extended integrity contract", () => {
  it("validates placement visibility at save and preserves unavailable preset references", async () => {
    const tag = await saveTaxonomy("tags", { name: "網站限定", slug: "extended-web-only", botVisible: false });
    await expect(saveTaxonomy("navigation", { label: "無效跨介面", tagIds: [tag.id], placement: "both" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(saveTaxonomy("navigation", { label: "未確認廣泛篩選" })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(saveTaxonomy("navigation", { label: "全部", allowBroad: true })).resolves.toBeDefined();
    const disabled = await saveTaxonomy("navigation", { label: "停用跨介面", tagIds: [tag.id], placement: "both", enabled: false });
    await expect(setPublication("navigation", disabled.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
    const preset = await saveTaxonomy("navigation", { label: "網站限定", tagIds: [tag.id], placement: "public" });
    await saveTaxonomy("tags", { name: "網站限定", slug: "extended-web-only", enabled: false }, tag.id);
    expect((await getTaxonomy()).navigation.some(p => p.id === preset.id)).toBe(false);
    const adminPreset = (await getTaxonomy("admin")).navigation.find(p => p.id === preset.id);
    expect(adminPreset).toMatchObject({ available: false, tagIds: [tag.id] });
  });
  it("rechecks dependencies after an earlier empty impact preview", async () => {
    const category = await saveTaxonomy("categories", { name: "Race", slug: "extended-race-category" });
    expect((await getTaxonomyImpact("categories", category.id)).presets).toBe(0);
    const preset = await saveTaxonomy("navigation", { label: "New dependency", categoryId: category.id });
    await expect(deleteTaxonomy("categories", category.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getTaxonomy()).navigation.find(p => p.id === preset.id)?.categoryId).toBe(category.id);
  });
  it("enforces scalar invariants even when writes bypass the application", async () => {
    await expect(db.execute(sql`insert into directory_categories(name,slug) values (' ', 'bad-empty')`)).rejects.toBeDefined();
    await expect(db.execute(sql`insert into directory_listings(name,slug,revision) values ('bad','bad-revision',0)`)).rejects.toBeDefined();
    await expect(db.execute(sql`insert into directory_navigation_presets(label,match_mode) values ('bad','xor')`)).rejects.toBeDefined();
    await expect(db.execute(sql`insert into directory_navigation_presets(label,price_min,price_max) values ('bad',10,0)`)).rejects.toBeDefined();
  });
});
