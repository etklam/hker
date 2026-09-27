import { AppError } from "@/lib/errors";
import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse, readJsonBody } from "@/server/catalog/http";
import {
  commitContentPlan,
  importSettingsSchema,
  prepareImport,
} from "@/server/catalog/content-plans";
// Preserve legacy CSV fields while using the same expiring, actor-bound reviewed plans.
export const POST = withAdmin(async (req, { user }) =>
  catalogResponse(async () => {
    const body = z
      .object({
        csv: z.string().max(500000),
        digest: z.string().length(64).optional(),
        operationId: z.uuid().optional(),
        decisions: z.record(z.string(), z.enum(["accept", "skip"])).default({}),
        confirm: z.boolean().default(false),
      })
      .parse(await readJsonBody(req, 1500000));
    if (body.confirm) {
      if (!body.operationId || !body.digest)
        throw new AppError(
          "INVALID_REQUEST",
          "Preview operationId and digest required; changed decisions require a new preview",
        );
      return commitContentPlan(body.operationId, body.digest, user.id);
    }
    const plan = await prepareImport(
      body.csv,
      importSettingsSchema.parse({ decisions: body.decisions }),
      user.id,
    );
    return {
      operationId: plan.id,
      digest: plan.digest,
      expiresAt: plan.expiresAt,
      ...plan.payload,
    };
  }),
);
