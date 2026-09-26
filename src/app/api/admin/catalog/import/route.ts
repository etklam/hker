import { AppError } from "@/lib/errors";
import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { parseBody } from "@/schemas/parse-body";
import { catalogResponse } from "@/server/catalog/http";
import { previewImport, confirmImport } from "@/server/catalog/import";
export const POST = withAdmin(async (req) =>
  catalogResponse(async () => {
    const body = parseBody(
      await req.json(),
      z.object({
        csv: z.string().max(500000),
        digest: z.string().length(64).optional(),
        confirm: z.boolean().default(false),
      }),
    );
    if (body.confirm) {
      if (!body.digest)
        throw new AppError("INVALID_REQUEST", "Preview digest required");
      return confirmImport(body.csv, body.digest);
    }
    const result = await previewImport(body.csv);
    return {
      ...result,
      items: result.items.map(({ data, ...item }) => ({
        ...item,
        priceMin: data?.priceMin ?? null,
        priceMax: data?.priceMax ?? null,
      })),
    };
  }),
);
