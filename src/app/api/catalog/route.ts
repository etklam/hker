import { allowCatalogRequest } from "@/server/catalog/abuse";
import { withOptionalAuth } from "@/server/api-helpers";
import { CatalogSearchService, getTaxonomy } from "@/server/catalog/service";
import { AppError } from "@/lib/errors";
import { resolveSearchParams } from "@/lib/directory";
import { catalogResponse } from "@/server/catalog/http";
import { publicCatalogListing } from "@/server/catalog/public-dto";
export const dynamic = "force-dynamic";
export const GET = withOptionalAuth(async (req) => {
  return catalogResponse(async () => {
    if (req.nextUrl.searchParams.has("audience") && req.nextUrl.searchParams.get("audience") !== "public")
      throw new AppError("INVALID_REQUEST", "Invalid public audience");
    if (!(await allowCatalogRequest(req.headers, "catalog-api", 90)))
      throw new AppError("INVALID_REQUEST", "搜尋過於頻繁，請稍後再試。");
    const taxonomy = await getTaxonomy();
    if (req.nextUrl.searchParams.get("taxonomy") === "1") return taxonomy;
    let input;
    try {
      input = resolveSearchParams(req.nextUrl.searchParams, taxonomy);
    } catch (error) {
      throw new AppError(
        "INVALID_REQUEST",
        error instanceof Error ? error.message : "搜尋條件無效",
      );
    }
    const result = await CatalogSearchService.search(input);
    return { ...result, items: result.items.map(publicCatalogListing) };
  });
});
