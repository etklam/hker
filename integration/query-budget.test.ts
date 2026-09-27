import { afterAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as directory from "@/db/schema/directory";
import {
  CatalogSearchService,
  type CatalogExecutor,
} from "@/server/catalog/service";

const SEARCH_QUERY_BUDGET = 7;
const DETAIL_QUERY_BUDGET = 5;
const rollback = new Error("ROLLBACK_QUERY_BUDGET_FIXTURE");
let queries = 0;
const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const countedDb = drizzle(client, {
  schema: directory,
  logger: { logQuery: () => queries++ },
});

afterAll(() => client.end({ timeout: 5 }));

describe("catalog query budgets", () => {
  it("keeps list and detail round trips bounded as a page grows", async () => {
    let completed = false;
    try {
      await countedDb.transaction(async (tx) => {
        const [category] = await tx
          .insert(directory.categories)
          .values({ name: "查詢預算分類", slug: "query-budget-category" })
          .returning({ id: directory.categories.id });
        const [area] = await tx
          .insert(directory.areas)
          .values({ name: "查詢預算地區", slug: "query-budget-area" })
          .returning({ id: directory.areas.id });
        const [tag] = await tx
          .insert(directory.tags)
          .values({ name: "查詢預算標籤", slug: "query-budget-tag" })
          .returning({ id: directory.tags.id });
        const listings = await tx
          .insert(directory.listings)
          .values(
            Array.from({ length: 12 }, (_, index) => ({
              name: `查詢預算項目 ${index}`,
              slug: `query-budget-listing-${index}`,
              categoryId: category.id,
              areaId: area.id,
              enabled: true,
              sortOrder: -10_000 + index,
            })),
          )
          .returning({ id: directory.listings.id, slug: directory.listings.slug });
        await tx.insert(directory.listingLinks).values(
          listings.map((listing) => ({
            listingId: listing.id,
            type: "website",
            label: "網站",
            url: `https://example.invalid/${listing.slug}`,
          })),
        );
        await tx.insert(directory.listingTags).values(
          listings.map((listing) => ({ listingId: listing.id, tagId: tag.id })),
        );

        const executor = tx as unknown as CatalogExecutor;
        queries = 0;
        await CatalogSearchService.search({ pageSize: 1 }, "public", executor);
        const oneCardQueries = queries;
        queries = 0;
        await CatalogSearchService.search({ pageSize: 12 }, "public", executor);
        const fullPageQueries = queries;
        expect(fullPageQueries).toBe(oneCardQueries);
        expect(fullPageQueries).toBeLessThanOrEqual(SEARCH_QUERY_BUDGET);

        queries = 0;
        await CatalogSearchService.search(
          { tagIds: [tag.id], pageSize: 12 },
          "public",
          executor,
        );
        expect(queries).toBeLessThanOrEqual(SEARCH_QUERY_BUDGET);

        queries = 0;
        await CatalogSearchService.search(
          { status: "enabled", query: "查詢預算", pageSize: 12 },
          "admin",
          executor,
        );
        expect(queries).toBeLessThanOrEqual(SEARCH_QUERY_BUDGET);

        queries = 0;
        await CatalogSearchService.search(
          { query: "查詢預算", pageSize: 4 },
          "bot",
          executor,
        );
        expect(queries).toBeLessThanOrEqual(SEARCH_QUERY_BUDGET);

        queries = 0;
        await CatalogSearchService.detail(listings[0].slug, "public", executor);
        expect(queries).toBeLessThanOrEqual(DETAIL_QUERY_BUDGET);
        completed = true;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    expect(completed).toBe(true);
  });
});
