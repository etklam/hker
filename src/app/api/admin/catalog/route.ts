import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import {
  CatalogSearchService,
  getTaxonomy,
  saveListing,
  deleteListing,
  saveTaxonomy,
  deleteTaxonomy,
} from "@/server/catalog/service";
import { searchFromParams } from "@/lib/directory";
import { catalogResponse } from "@/server/catalog/http";
import { parseBody } from "@/schemas/parse-body";
const mutation = z.object({
  kind: z.enum([
    "listings",
    "categories",
    "areas",
    "tags",
    "groups",
    "navigation",
  ]),
  id: z.number().int().positive().optional(),
  data: z.unknown(),
});
export const GET = withAdmin(async (req) =>
  catalogResponse(async () =>
    req.nextUrl.searchParams.get("taxonomy") === "1"
      ? getTaxonomy("admin")
      : CatalogSearchService.search(
          searchFromParams(req.nextUrl.searchParams),
          "admin",
        ),
  ),
);
export const POST = withAdmin(async (req) =>
  catalogResponse(async () => {
    const { kind, id, data } = parseBody(await req.json(), mutation);
    return kind === "listings"
      ? saveListing(data, id)
      : saveTaxonomy(kind, data, id);
  }),
);
export const DELETE = withAdmin(async (req) =>
  catalogResponse(async () => {
    const { kind, id } = parseBody(
      await req.json(),
      mutation.omit({ data: true }).extend({ id: z.number().int().positive() }),
    );
    if (kind === "listings") await deleteListing(id);
    else await deleteTaxonomy(kind, id);
    return { ok: true };
  }),
);
