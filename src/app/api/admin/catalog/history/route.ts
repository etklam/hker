import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse } from "@/server/catalog/http";
import { contentHistory } from "@/server/catalog/history";
export const GET = withAdmin(async (req) =>
  catalogResponse(() =>
    contentHistory(
      req.nextUrl.searchParams.has("id")
        ? z.coerce
            .number()
            .int()
            .positive()
            .parse(req.nextUrl.searchParams.get("id"))
        : undefined,
    ),
  ),
);
