import { withOptionalAuth } from "@/server/api-helpers";
import { CatalogSearchService, getTaxonomy } from "@/server/catalog/service";
import { searchFromParams } from "@/lib/directory";
import { catalogResponse } from "@/server/catalog/http";
export const dynamic = "force-dynamic";
export const GET = withOptionalAuth(async (req) => {
  return catalogResponse(async () =>
    req.nextUrl.searchParams.get("taxonomy") === "1"
      ? getTaxonomy()
      : CatalogSearchService.search(searchFromParams(req.nextUrl.searchParams)),
  );
});
