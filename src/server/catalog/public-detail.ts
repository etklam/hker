import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CatalogSearchService } from "./service";
import { publicCatalogListing } from "./public-dto";
import { CATALOG_TAG } from "./cache";

// Two layers, both earning their place: React `cache` dedupes the two calls a
// single detail render makes (generateMetadata and the page); `unstable_cache`
// keeps the row out of Postgres across requests until an admin write drops the
// catalog tag.
export const publicListingDetail = cache(async (slug: string) =>
  unstable_cache(
    async () => {
      const listing = await CatalogSearchService.detail(slug);
      return listing ? publicCatalogListing(listing) : null;
    },
    ["catalog", "listing", slug],
    { tags: [CATALOG_TAG], revalidate: 300 },
  )(),
);
