import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { categories, listings } from "@/db/schema/directory";
import { catalogHistory, catalogPlans } from "@/db/schema/directoryOperations";
import { db } from "@/server/db";
import {
  commitContentPlan,
  getContentPlan,
  importSettingsSchema,
  prepareImport,
} from "@/server/catalog/content-plans";
import { CatalogSearchService, saveTaxonomy } from "@/server/catalog/service";

if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test"))
  throw new Error("Use isolated hker_directory_test only");

describe("release-candidate content-plan taxonomy revalidation", () => {
  it("rejects the whole import when reviewed taxonomy is disabled and preserves the plan source", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const categorySlug = `rc-plan-category-${suffix}`;
    const listingSlugs = [
      `rc-plan-first-${suffix}`,
      `rc-plan-second-${suffix}`,
    ];
    const setupOperations = [
      `rc-plan-category-create-${suffix}`,
      `rc-plan-category-disable-${suffix}`,
    ];
    let categoryId: number | undefined;
    let planId: string | undefined;
    try {
      const category = await saveTaxonomy(
        "categories",
        { name: "RC 計畫分類", slug: categorySlug },
        undefined,
        { operationId: setupOperations[0] },
      );
      categoryId = category.id;
      const source = [
        "name,slug,categoryId",
        `RC 計畫甲,${listingSlugs[0]},${category.id}`,
        `RC 計畫乙,${listingSlugs[1]},${category.id}`,
      ].join("\n");
      const settings = importSettingsSchema.parse({ mode: "create" });
      const plan = await prepareImport(source, settings, 901);
      planId = plan.id;

      await saveTaxonomy(
        "categories",
        { name: category.name, slug: category.slug, enabled: false },
        category.id,
        { operationId: setupOperations[1] },
      );

      await expect(
        commitContentPlan(plan.id, plan.digest, 901),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        Promise.all(
          listingSlugs.map((slug) =>
            CatalogSearchService.detail(slug, "admin"),
          ),
        ),
      ).resolves.toEqual([null, null]);
      expect(
        await db
          .select()
          .from(catalogHistory)
          .where(eq(catalogHistory.operationId, plan.id)),
      ).toHaveLength(0);
      expect(await getContentPlan(plan.id, 901)).toMatchObject({
        result: null,
        payload: { source },
      });
    } finally {
      await db.delete(listings).where(inArray(listings.slug, listingSlugs));
      if (planId)
        await db.delete(catalogPlans).where(eq(catalogPlans.id, planId));
      await db
        .delete(catalogHistory)
        .where(inArray(catalogHistory.operationId, setupOperations));
      if (categoryId)
        await db.delete(categories).where(eq(categories.id, categoryId));
    }
  });
});
