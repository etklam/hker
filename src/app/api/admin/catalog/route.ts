import {
  reorderVisible,
  setPublication,
  suggestSlug,
} from "@/server/catalog/admin";
import { resolveNavigationPreset } from "@/lib/directory-presets";
import { z } from "zod";
import { withAdmin } from "@/server/api-helpers";
import {
  CatalogSearchService,
  getTaxonomy,
  saveListing,
  deleteListing,
  saveTaxonomy,
  deleteTaxonomy,
} from "@/server/catalog/service";
import { searchFromParams } from "@/lib/directory";
import { catalogResponse, readJsonBody } from "@/server/catalog/http";
import { parseBody } from "@/schemas/parse-body";
const mutation = z.object({
  kind: z.enum([
    "listings",
    "categories",
    "areas",
    "tags",
    "groups",
    "navigation",
  ]),
  id: z.number().int().positive().optional(),
  data: z.unknown(),
});
export const GET = withAdmin(async (req) =>
  catalogResponse(async () => {
    const params = req.nextUrl.searchParams;
    if (params.get("slugName")) {
      const kind = parseBody(
        params.get("kind"),
        z.enum(["listings", "categories", "areas", "tags", "groups"]),
      );
      return suggestSlug(
        kind,
        parseBody(params.get("slugName"), z.string().min(1).max(200)),
      );
    }
    if (params.get("settings") === "1")
      return {
        publicUrlConfigured: Boolean(process.env.APP_BASE_URL),
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        webhookProtected: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      };
    if (params.get("preview")) {
      const audience = params.get("audience") === "bot" ? "bot" : "public";
      const taxonomy = await getTaxonomy(audience);
      const preset = taxonomy.navigation.find(
        (item) => item.id === Number(params.get("preview")),
      );
      if (!preset?.available)
        return {
          available: false,
          message: "此導覽未啟用、網站不可見，或包含停用條件；請檢查設定。",
        };
      const resolved = resolveNavigationPreset(preset, taxonomy, audience);
      if (!resolved.available) return { available: false, message: resolved.reason };
      const result = await CatalogSearchService.search(resolved.search, audience);
      return {
        available: true,
        summary: { ...resolved.search, matchDescription: resolved.search.tagMatchMode === "or" ? "符合任一標籤" : "符合所有標籤" },
        total: result.total,
        items: result.items.slice(0, 3).map((item) => item.name),
      };
    }
    return params.get("taxonomy") === "1"
      ? getTaxonomy("admin")
      : CatalogSearchService.search(searchFromParams(params), "admin");
  }),
);
export const PATCH = withAdmin(async (req) =>
  catalogResponse(async () => {
    const value = parseBody(
      await readJsonBody(req),
      z.discriminatedUnion("action", [
        z.object({
          action: z.literal("publish"),
          kind: mutation.shape.kind,
          id: z.number().int().positive(),
          enabled: z.boolean(),
          revision: z.number().int().positive().optional(),
        }),
        z.object({
          action: z.literal("reorder"),
          kind: z.enum(["listings", "navigation"]),
          entries: z
            .array(
              z.object({
                id: z.number().int().positive(),
                sortOrder: z.number().int(),
                revision: z.number().int().positive().optional(),
              }),
            )
            .min(2)
            .max(100),
          ids: z.array(z.number().int().positive()).min(2).max(100),
        }),
      ]),
    );
    if (value.action === "publish")
      return setPublication(
        value.kind,
        value.id,
        value.enabled,
        value.revision,
      );
    parseBody(
      value,
      z
        .object({
          ids: z.array(z.number()),
          entries: z.array(z.object({ id: z.number() })),
        })
        .refine(
          (v) =>
            new Set(v.ids).size === v.ids.length &&
            v.ids.length === v.entries.length &&
            v.entries.every((e) => v.ids.includes(e.id)) &&
            new Set(v.entries.map((e) => e.id)).size === v.entries.length,
          "排序項目不一致",
        ),
    );
    return reorderVisible(value.kind, value.entries, value.ids);
  }),
);
export const POST = withAdmin(async (req) =>
  catalogResponse(async () => {
    const { kind, id, data } = parseBody(await readJsonBody(req), mutation);
    return kind === "listings"
      ? saveListing(data, id)
      : saveTaxonomy(kind, data, id);
  }),
);
export const DELETE = withAdmin(async (req) =>
  catalogResponse(async () => {
    const { kind, id } = parseBody(
      await readJsonBody(req),
      mutation.omit({ data: true }).extend({ id: z.number().int().positive() }),
    );
    if (kind === "listings") await deleteListing(id);
    else await deleteTaxonomy(kind, id);
    return { ok: true };
  }),
);
