import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { CatalogSearchService, getTaxonomy } from "./service";
import { publicCatalogListing } from "./public-dto";
import { catalogResponse } from "./http";

/**
 * Cross-request cache for the public read paths.
 *
 * Every public page is `force-dynamic` and has to stay that way: the image is
 * built without database access (`db.ts` falls back to a dead URL during
 * `phase-production-build`), so nothing can be statically generated. That makes
 * the route the wrong place to cache and the data layer the right one.
 *
 * Only the default `public` audience and the default executor are cached here.
 * Admin and bot reads pass an explicit audience, and transactional reads pass
 * an executor — neither goes through this module, so no audience-scoped or
 * mid-transaction row can leak into a shared cache entry.
 */
export const CATALOG_TAG = "catalog";

/** Safety net: a missed invalidation goes stale for minutes, not forever. */
const MAX_AGE = 300;

export const cachedTaxonomy = unstable_cache(
  () => getTaxonomy(),
  ["catalog", "taxonomy"],
  {
    tags: [CATALOG_TAG],
    revalidate: MAX_AGE,
  },
);

/**
 * The home board's two fixed queries. Mapped to the public DTO inside the
 * cache so the stored payload is already serializable and carries no
 * admin-only column.
 */
export const cachedHomeSections = unstable_cache(
  async () => {
    const [featured, newest] = await Promise.all([
      CatalogSearchService.search({ featured: true, pageSize: 8 }),
      CatalogSearchService.search({ sort: "newest", pageSize: 8 }),
    ]);
    return {
      featured: {
        total: featured.total,
        items: featured.items.map(publicCatalogListing),
      },
      newest: {
        total: newest.total,
        items: newest.items.map(publicCatalogListing),
      },
    };
  },
  ["catalog", "home"],
  { tags: [CATALOG_TAG], revalidate: MAX_AGE },
);

/**
 * Drop every cached public read. One tag rather than several: a listing edit
 * can move a counter on the home board and a taxonomy edit can change what a
 * listing renders, so partial invalidation would be the bug, not the feature.
 */
export function revalidateCatalog() {
  revalidateTag(CATALOG_TAG);
}

/**
 * `catalogResponse` for admin handlers that write. Invalidation runs only when
 * the work resolved, so a rejected or conflicted mutation leaves the cache
 * alone, and it is attached to the response helper rather than to each service
 * function so a new admin route cannot forget it.
 */
export async function catalogMutation(work: () => Promise<unknown>) {
  return catalogResponse(async () => {
    const result = await work();
    revalidateCatalog();
    return result;
  });
}
