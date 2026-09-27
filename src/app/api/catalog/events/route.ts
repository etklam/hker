import { z } from "zod";
import { readJsonBody, catalogResponse } from "@/server/catalog/http";
import { allowCatalogRequest } from "@/server/catalog/abuse";
import {
  analyticsEnabled,
  issueCatalogEventReceipt,
  recordCatalogEvent,
  verifyCatalogEventReceipt,
} from "@/server/catalog/analytics";
import { CatalogSearchService } from "@/server/catalog/service";
import { searchSchema } from "@/schemas/directory";
import { AppError } from "@/lib/errors";

export async function GET(req: Request) {
  if (!analyticsEnabled())
    return Response.json({ status: "disabled" }, { headers: { "Cache-Control": "no-store" } });
  if (!(await allowCatalogRequest(req.headers, "event-receipts", 60).catch(() => false)))
    return new Response(null, { status: 429 });
  const receipt = issueCatalogEventReceipt();
  return receipt
    ? Response.json(receipt, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ status: "degraded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(process.env.APP_BASE_URL ?? req.url).origin)
    return new Response(null, { status: 403 });
  if (!analyticsEnabled())
    return Response.json({ ok: true, status: "disabled" });
  if (!(await allowCatalogRequest(req.headers, "events", 30)))
    return new Response(null, { status: 429 });
  return catalogResponse(async () => {
    const body = z
      .object({
        kind: z.enum(["search", "filter", "preset", "tag"]),
        key: z.string().max(200),
        source: z.literal("web"),
        receipt: z.object({
          actionId: z.uuid(),
          occurredAt: z.iso.datetime({ offset: true }),
          signature: z.string().regex(/^[a-f0-9]{64}$/),
        }),
        search: searchSchema.optional(),
      })
      .parse(await readJsonBody(req, 12000));
    if (!verifyCatalogEventReceipt(body.receipt))
      throw new AppError("INVALID_REQUEST", "量測收據無效或已被修改");
    let zeroResult = false;
    if (body.kind === "search" || body.kind === "filter") {
      const structured = body.search;
      if (
        (body.kind === "search" && !body.key.trim()) ||
        (body.kind === "filter" &&
          (!structured ||
            (!structured.categoryId &&
              !structured.areaId &&
              !structured.tagIds?.length &&
              structured.priceMin === null &&
              structured.priceMax === null &&
              structured.featured === undefined)))
      )
        throw new AppError("INVALID_REQUEST", "無可量測的搜尋操作");
      const result = await CatalogSearchService.search({
        ...structured,
        query: body.kind === "search" ? body.key : "",
        page: 1,
        pageSize: 1,
      });
      zeroResult = result.total === 0;
    }
    const status = await recordCatalogEvent({
      kind: body.kind,
      key: body.key,
      source: body.source,
      actionId: body.receipt.actionId,
      occurredAt: body.receipt.occurredAt,
      zeroResult,
    });
    return { ok: true, status };
  });
}
