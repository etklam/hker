import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse, readJsonBody } from "@/server/catalog/http";
import {
  analyticsReport,
  deleteStoredQuery,
  hongKongDay,
  privateQueryKey,
} from "@/server/catalog/analytics";
import { CatalogSearchService } from "@/server/catalog/service";
import { parseBody } from "@/schemas/parse-body";
import { AppError } from "@/lib/errors";
export const GET = withAdmin(async (req) =>
  catalogResponse(async () => {
    const inspection = req.nextUrl.searchParams.get("inspect");
    if (inspection !== null) {
      const query = privateQueryKey(inspection);
      if (!query)
        throw new AppError(
          "INVALID_REQUEST",
          "Only eligible stored queries can be inspected",
        );
      const result = await CatalogSearchService.search(
        { query, page: 1, pageSize: 1 },
        "public",
      );
      return {
        query,
        total: result.total,
        inspectedAt: new Date().toISOString(),
      };
    }
    const today = new Date();
    const from =
        req.nextUrl.searchParams.get("from") ??
        hongKongDay(new Date(today.getTime() - 30 * 86400000)),
      to =
        req.nextUrl.searchParams.get("to") ?? hongKongDay(today),
      source = req.nextUrl.searchParams.get("source") ?? "all";
    const range = z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        source: z.enum(["all", "web", "bot"]),
      })
      .refine(
        (v) =>
          v.from <= v.to &&
          Date.parse(v.to) - Date.parse(v.from) <= 90 * 86400000,
      )
      .parse({ from, to, source });
    return analyticsReport(range.from, range.to, range.source);
  }),
);

export const DELETE = withAdmin(async (req) =>
  catalogResponse(async () => {
    const body = parseBody(
      await readJsonBody(req, 1000),
      z.object({ query: z.string().min(2).max(80) }),
    );
    return { deletedRows: await deleteStoredQuery(body.query) };
  }),
);
