import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import { catalogResponse, readJsonBody } from "@/server/catalog/http";
import {
  bulkSchema,
  commitContentPlan,
  getContentPlan,
  importSettingsSchema,
  prepareBulk,
  prepareImport,
  prepareTaxonomyImport,
  recentContentPlans,
} from "@/server/catalog/content-plans";
export const GET = withAdmin(async (req, { user }) =>
  catalogResponse(() =>
    req.nextUrl.searchParams.has("id")
      ? getContentPlan(
          z.uuid().parse(req.nextUrl.searchParams.get("id")),
          user.id,
        )
      : recentContentPlans(user.id),
  ),
);
export const POST = withAdmin(async (req, { user }) =>
  catalogResponse(async () => {
    const body = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("import"),
          source: z.string().max(500000),
          settings: importSettingsSchema,
        }),
        z.object({
          action: z.literal("taxonomy"),
          source: z.string().max(500000),
        }),
        z.object({ action: z.literal("bulk"), input: bulkSchema }),
        z.object({
          action: z.literal("commit"),
          id: z.uuid(),
          digest: z.string().length(64),
        }),
      ])
      .parse(await readJsonBody(req, 1500000));
    if (body.action === "taxonomy")
      return prepareTaxonomyImport(body.source, user.id);
    if (body.action === "import")
      return prepareImport(body.source, body.settings, user.id);
    if (body.action === "bulk") return prepareBulk(body.input, user.id);
    return commitContentPlan(body.id, body.digest, user.id);
  }),
);
