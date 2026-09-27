import { z } from "zod";
import { readJsonBody, catalogResponse } from "@/server/catalog/http";
import { allowCatalogRequest } from "@/server/catalog/abuse";
import { recordCatalogEvent } from "@/server/catalog/analytics";
import { CatalogSearchService } from "@/server/catalog/service";
import { searchSchema } from "@/schemas/directory";
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(process.env.APP_BASE_URL ?? req.url).origin)
    return new Response(null, { status: 403 });
  if (!(await allowCatalogRequest(req.headers, "events", 30)))
    return new Response(null, { status: 429 });
  return catalogResponse(async () => {
    const body = z
      .object({
        kind: z.enum(["search", "preset", "tag"]),
        key: z.string().max(200),
        source: z.literal("web"),
        actionId: z.uuid(),
        search: searchSchema.optional(),
      })
      .parse(await readJsonBody(req, 12000));
    let zeroResult = false;
    if (body.kind === "search") {
      const result = await CatalogSearchService.search({
        ...body.search,
        query: body.key,
        page: 1,
        pageSize: 1,
      });
      zeroResult = result.total === 0;
    }
    await recordCatalogEvent({ ...body, zeroResult });
    return { ok: true };
  });
}
