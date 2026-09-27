import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse } from "@/server/catalog/http";
import { exportCatalog } from "@/server/catalog/export";
export const GET = withAdmin(async (req) => {
  let body = "",
    format: "csv" | "json" = "json";
  const check = await catalogResponse(async () => {
    format = z
      .enum(["json", "csv"])
      .parse(req.nextUrl.searchParams.get("format"));
    const ids = z
      .array(z.coerce.number().int().positive())
      .min(1)
      .max(200)
      .parse((req.nextUrl.searchParams.get("ids") ?? "").split(","));
    body = await exportCatalog(ids, format);
    return { ok: true };
  });
  if (!check.ok) return check;
  return new Response(body, {
    headers: {
      "Content-Type":
        format === "json"
          ? "application/json; charset=utf-8"
          : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hker-catalog.${format}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
