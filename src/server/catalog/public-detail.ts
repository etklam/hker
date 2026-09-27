import { cache } from "react";
import { CatalogSearchService } from "./service";
import { publicCatalogListing } from "./public-dto";

// React Server Component request lifetime only; never shared across requests.
export const publicListingDetail = cache(async (slug: string) => {
  const listing = await CatalogSearchService.detail(slug);
  return listing ? publicCatalogListing(listing) : null;
});
