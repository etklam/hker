import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse, readJsonBody } from "@/server/catalog/http";
import {
  analyticsReport,
  deleteStoredQuery,
  hongKongDay,
} from "@/server/catalog/analytics";
import { parseBody } from "@/schemas/parse-body";
export const GET = withAdmin(async (req) =>
  catalogResponse(async () => {
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
