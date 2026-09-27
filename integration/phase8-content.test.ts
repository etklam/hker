import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { catalogHistory } from "@/db/schema/directoryOperations";
import {
  CatalogSearchService,
  saveListing,
  saveTaxonomy,
} from "@/server/catalog/service";
import {
  commitContentPlan,
  getContentPlan,
  importSettingsSchema,
  prepareBulk,
  prepareImport,
  prepareTaxonomyImport,
} from "@/server/catalog/content-plans";
import { exportCatalog } from "@/server/catalog/export";
import { nativeCatalogSchema } from "@/server/catalog/native-format";
const settings = (mode: "create" | "update" = "create") =>
  importSettingsSchema.parse({ mode });
beforeAll(async () => {
  await db.execute(
    sql`truncate directory_content_plans,directory_content_history,directory_listings,directory_categories,directory_areas,directory_tags,directory_tag_groups,directory_navigation_presets restart identity cascade`,
  );
});
describe("Phase 8 reviewed content operations", () => {
  it("stores actor-protected plans; selected rows create drafts and lost response replays once", async () => {
    const source =
      "name,slug,website\n虛構服務,phase8-created,https://example.test/A#B\n,invalid-row,";
    const plan = await prepareImport(
      source,
      { ...settings(), decisions: { "3": "skip" } },
      1,
    );
    await expect(getContentPlan(plan.id, 2)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const results = await Promise.all([
      commitContentPlan(plan.id, plan.digest, 1),
      commitContentPlan(plan.id, plan.digest, 1),
    ]);
    expect(results[0]).toMatchObject({ created: 1, skipped: 1 });
    expect(results[1]).toMatchObject({ created: 1, skipped: 1 });
    const row = await CatalogSearchService.detail("phase8-created", "admin");
    expect(row?.enabled).toBe(false);
    expect(
      await db
        .select()
        .from(catalogHistory)
        .where(eq(catalogHistory.operationId, plan.id)),
    ).toHaveLength(1);
    expect((await getContentPlan(plan.id, 1)).payload).toEqual({});
  });
  it("rejects a stale update atomically, preserves source, links and blank untouched fields", async () => {
    const first = await saveListing({
      name: "第一",
      slug: "phase8-first",
      shortDescription: "保留",
      enabled: true,
      links: [
        {
          type: "website",
          label: "原連結",
          url: "https://example.test/original",
        },
      ],
    });
    await saveListing({ name: "第二", slug: "phase8-second" });
    const original = (await CatalogSearchService.detail(first.slug, "admin"))!;
    const source =
      "name,slug,shortDescription,website\n第一,phase8-first,,https://example.test/new\n第二更新,phase8-second,,";
    const plan = await prepareImport(source, settings("update"), 1);
    await saveListing(
      { ...original, shortDescription: "另一編輯", tagIds: [] },
      first.id,
    );
    await expect(
      commitContentPlan(plan.id, plan.digest, 1),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await CatalogSearchService.detail("phase8-second", "admin"))?.name,
    ).toBe("第二");
    expect((await getContentPlan(plan.id, 1)).payload.source).toBe(source);
    const next = await prepareImport(source, settings("update"), 1);
    expect(await commitContentPlan(next.id, next.digest, 1)).toMatchObject({
      updated: 2,
    });
    const changed = (await CatalogSearchService.detail(first.slug, "admin"))!;
    expect(changed).toMatchObject({
      enabled: true,
      shortDescription: "另一編輯",
    });
    expect(changed.links[0].id).toBe(original.links[0].id);
    expect(changed.links).toHaveLength(2);
  });
  it("freezes bulk IDs and revisions; concurrent new rows are excluded", async () => {
    const a = await saveListing({ name: "批次 A", slug: "phase8-bulk-a" });
    const b = await saveListing({ name: "批次 B", slug: "phase8-bulk-b" });
    const plan = await prepareBulk(
      {
        entries: [a, b].map(({ id, revision }) => ({ id, revision })),
        patch: { enabled: true, addTags: [], removeTags: [] },
      },
      1,
    );
    const c = await saveListing({ name: "批次 C", slug: "phase8-bulk-c" });
    expect(await commitContentPlan(plan.id, plan.digest, 1)).toMatchObject({
      updated: 2,
    });
    expect(await CatalogSearchService.detail(c.slug)).toBeNull();
    expect(await CatalogSearchService.detail(a.slug)).not.toBeNull();
  });
  it("exports portable content without identities and restores taxonomy + unpublished listings", async () => {
    const parent = await saveTaxonomy("areas", {
      name: "虛構大區",
      slug: "phase8-parent",
    });
    const area = await saveTaxonomy("areas", {
      name: "虛構小區",
      slug: "phase8-child",
      parentId: parent.id,
    });
    const tag = await saveTaxonomy("tags", {
      name: "虛構標籤",
      slug: "phase8-tag",
      aliases: ["虛構別稱"],
    });
    const saved = await saveListing({
      name: "可攜內容",
      slug: "phase8-portable",
      areaId: area.id,
      tagIds: [tag.id],
      aliases: ["可攜別稱"],
      enabled: true,
      priceMin: 0,
      links: [
        { type: "website", label: "一", url: "https://example.test/#one" },
        { type: "website", label: "二", url: "https://example.test/#two" },
      ],
    });
    const source = await exportCatalog([saved.id], "json");
    const document = nativeCatalogSchema.parse(JSON.parse(source));
    expect(document.listings[0]).toMatchObject({
      areaSlug: area.slug,
      enabled: true,
      priceMin: "0.00",
    });
    expect(source).not.toMatch(
      /"(?:id|actorId|password|session|chatKey|revision)"/,
    );
    await db.execute(
      sql`truncate directory_listings,directory_categories,directory_areas,directory_tags,directory_tag_groups,directory_navigation_presets restart identity cascade`,
    );
    const taxonomyPlan = await prepareTaxonomyImport(source, 1);
    await commitContentPlan(taxonomyPlan.id, taxonomyPlan.digest, 1);
    const plan = await prepareImport(source, settings(), 1);
    expect(await commitContentPlan(plan.id, plan.digest, 1)).toMatchObject({
      created: 1,
    });
    const restored = (await CatalogSearchService.detail(saved.slug, "admin"))!;
    expect(restored).toMatchObject({
      enabled: false,
      aliases: ["可攜別稱"],
      priceMin: "0.00",
    });
    expect(restored.links).toHaveLength(2);
    expect(restored.tags[0].slug).toBe("phase8-tag");
  });
});
