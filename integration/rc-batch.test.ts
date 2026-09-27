import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { createDatabase, db } from "@/server/db";
import { listings, listingLinks, listingTags } from "@/db/schema/directory";
import { saveTaxonomy } from "@/server/catalog/service";
import { prepareBulk } from "@/server/catalog/content-plans";
import { exportCatalog } from "@/server/catalog/export";
const ids: number[] = [];
const run = `rc05-${Date.now()}`;
afterAll(async () => {
  if (ids.length) await db.delete(listings).where(inArray(listings.id, ids));
});
describe("RC-05 bounded batch reads", () => {
  it("hydrates 1, 20 and 200 selected records with bounded statement counts and retained relations", async () => {
    const category = await saveTaxonomy("categories", {
      name: "虛構效能分類",
      slug: `${run}-category`,
    });
    const area = await saveTaxonomy("areas", {
      name: "虛構效能地區",
      slug: `${run}-area`,
    });
    const tag = await saveTaxonomy("tags", {
      name: "虛構隱藏標籤",
      slug: `${run}-tag`,
      enabled: false,
      aliases: ["別稱"],
    });
    const rows = await db
      .insert(listings)
      .values(
        Array.from({ length: 200 }, (_, i) => ({
          name: `虛構效能 ${i}`,
          slug: `${run}-${i}`,
          categoryId: category.id,
          areaId: area.id,
          aliases: ["保留別稱"],
        })),
      )
      .returning();
    ids.push(...rows.map((row) => row.id));
    await db.insert(listingLinks).values(
      rows.flatMap((row) => [
        {
          listingId: row.id,
          type: "website" as const,
          label: "一",
          url: "https://example.test/one",
        },
        {
          listingId: row.id,
          type: "website" as const,
          label: "二",
          url: "https://example.test/two",
        },
      ]),
    );
    await db
      .insert(listingTags)
      .values(rows.map((row) => ({ listingId: row.id, tagId: tag.id })));
    let count = 0;
    const measured = createDatabase(process.env.DATABASE_URL!, {
      logger: {
        logQuery: () => {
          count++;
        },
      },
    });
    const observations: unknown[] = [];
    try {
      for (const size of [1, 20, 200]) {
        const selected = rows.slice(0, size);
        count = 0;
        const start = performance.now();
        const plan = await prepareBulk(
          {
            entries: selected.map((row) => ({
              id: row.id,
              revision: row.revision,
            })),
            patch: { enabled: true, addTags: [], removeTags: [] },
          },
          1,
          measured.db,
        );
        const bulkCount = count;
        const bulkMs = performance.now() - start;
        expect(plan.payload.rows as unknown[]).toHaveLength(size);
        count = 0;
        const exportStart = performance.now();
        const exported = JSON.parse(
          await exportCatalog(
            selected.map((row) => row.id),
            "json",
            measured.db,
          ),
        );
        observations.push({
          size,
          bulkStatements: bulkCount,
          bulkMs,
          exportStatements: count,
          exportMs: performance.now() - exportStart,
        });
        expect(exported.listings).toHaveLength(size);
        expect(exported.listings[0]).toMatchObject({
          aliases: ["保留別稱"],
          tagSlugs: [tag.slug],
        });
        expect(exported.listings[0].links).toHaveLength(2);
      }
      console.log("RC05_STATEMENTS", JSON.stringify(observations));
      mkdirSync("artifacts/release-candidate", { recursive: true });
      writeFileSync(
        "artifacts/release-candidate/rc05-statements.json",
        JSON.stringify(
          { node: process.version, concurrency: 1, observations },
          null,
          2,
        ),
      );
      for (const row of observations as {
        bulkStatements: number;
        exportStatements: number;
      }[]) {
        expect(row.bulkStatements).toBeLessThanOrEqual(24);
        expect(row.exportStatements).toBeLessThanOrEqual(24);
      }
    } finally {
      await measured.close();
    }
  });
});
