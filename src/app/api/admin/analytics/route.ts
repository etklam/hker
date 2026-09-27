import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse } from "@/server/catalog/http";
import { analyticsReport } from "@/server/catalog/analytics";
export const GET = withAdmin(async (req) =>
  catalogResponse(async () => {
    const today = new Date();
    const from =
        req.nextUrl.searchParams.get("from") ??
        new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10),
      to =
        req.nextUrl.searchParams.get("to") ?? today.toISOString().slice(0, 10);
    const range = z
      .object({ from: z.iso.date(), to: z.iso.date() })
      .refine(
        (v) =>
          v.from <= v.to &&
          Date.parse(v.to) - Date.parse(v.from) <= 90 * 86400000,
      )
      .parse({ from, to });
    return analyticsReport(range.from, range.to);
  }),
);
