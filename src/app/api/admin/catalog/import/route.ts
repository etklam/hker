import { AppError } from "@/lib/errors";
import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { parseBody } from "@/schemas/parse-body";
import { catalogResponse, readJsonBody } from "@/server/catalog/http";
import { previewImport, confirmImport } from "@/server/catalog/import";
export const POST = withAdmin(async (req, { user }) =>
  catalogResponse(async () => {
    const body = parseBody(
      await readJsonBody(req, 1_500_000),
      z.object({
        csv: z.string().max(500000),
        digest: z.string().length(64).optional(),
        requestKey: z.string().uuid().optional(),
        decisions: z.record(z.string(), z.enum(["accept", "skip"])).optional(),
        confirm: z.boolean().default(false),
      }),
    );
    if (body.confirm) {
      if (!body.digest)
        throw new AppError("INVALID_REQUEST", "Preview digest required");
      if (!body.requestKey)
        throw new AppError("INVALID_REQUEST", "Import operation key required");
      return confirmImport(body.csv, body.digest, {
        actorId: user.id,
        requestKey: body.requestKey,
        decisions: body.decisions,
      });
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
