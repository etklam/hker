import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { listings } from "@/db/schema/directory";
import { catalogHistory } from "@/db/schema/directoryOperations";
import { CatalogSearchService, saveListing } from "@/server/catalog/service";
import { exportCatalog } from "@/server/catalog/export";
import {
  commitContentPlan,
  importSettingsSchema,
  prepareImport,
} from "@/server/catalog/content-plans";

const ids: number[] = [];
const run = `rc01-${Date.now()}`;
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
afterAll(async () => {
  if (ids.length) await db.delete(listings).where(inArray(listings.id, ids));
});
describe("RC-01 update row isolation", () => {
  it("keeps malformed native records separate from valid records in a valid envelope", async () => {
    const one = await saveListing({
      name: "虛構原生一",
      slug: `${run}-native-one`,
    });
    const two = await saveListing({
      name: "虛構原生二",
      slug: `${run}-native-two`,
    });
    ids.push(one.id, two.id);
    const document = JSON.parse(await exportCatalog([one.id, two.id], "json"));
    document.listings[0].shortDescription = "原生有效更新";
    document.listings[1].attrs = null;
    const plan = await prepareImport(
      JSON.stringify(document),
      importSettingsSchema.parse({
        mode: "update",
        decisions: { "3": "skip" },
      }),
      1,
    );
    expect(
      (plan.payload.rows as { errors: string[] }[])[1].errors.join(" "),
    ).toContain("attrs");
    expect(await commitContentPlan(plan.id, plan.digest, 1)).toMatchObject({
      updated: 1,
      skipped: 1,
    });
    expect(
      (await CatalogSearchService.detail(two.slug, "admin"))?.revision,
    ).toBe(1);
  });
  it("reports malformed embedded JSON per row, commits only reviewed valid rows and replays once", async () => {
    const good = await saveListing({
      name: "虛構 RC 有效",
      slug: `${run}-good`,
    });
    const bad = await saveListing({
      name: "虛構 RC 略過",
      slug: `${run}-bad`,
      links: [
        {
          type: "website",
          label: "原連結",
          url: "https://example.test/rc-original",
        },
      ],
    });
    ids.push(good.id, bad.id);
    const original = await CatalogSearchService.detail(bad.slug, "admin");
    const source = `formatVersion,slug,shortDescription,attrsJson\n2,${good.slug},有效更新,{}\n2,${bad.slug},不可寫入,${csvCell("{broken")}`;
    const settings = importSettingsSchema.parse({ mode: "update" });
    const preview = await prepareImport(source, settings, 1);
    const rows = preview.payload.rows as {
      row: number;
      errors: string[];
      diff: unknown;
    }[];
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].diff).toHaveProperty("shortDescription");
    expect(rows[1].errors.join(" ")).toMatch(/attrs/);
    await expect(
      commitContentPlan(preview.id, preview.digest, 1),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const selected = await prepareImport(
      source,
      { ...settings, decisions: { "3": "skip" } },
      1,
    );
    const result = await commitContentPlan(selected.id, selected.digest, 1);
    expect(result).toMatchObject({ updated: 1, skipped: 1 });
    expect(
      await commitContentPlan(selected.id, selected.digest, 1),
    ).toMatchObject({ ...result, replayed: true });
    expect(await CatalogSearchService.detail(bad.slug, "admin")).toEqual(
      original,
    );
    expect(
      await db
        .select()
        .from(catalogHistory)
        .where(eq(catalogHistory.operationId, selected.id)),
    ).toHaveLength(1);
  });
});
