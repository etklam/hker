import { commitTaxonomyImport, taxonomyImportPreview } from "./taxonomy-import";
import { parseImportSource } from "./native-format";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { catalogPlans } from "@/db/schema/directoryOperations";
import { listings, categories, areas, tags } from "@/db/schema/directory";
import {
  listingSchema,
  type ListingInput,
  type SearchInput,
} from "@/schemas/directory";
import { AppError } from "@/lib/errors";
import {
  CatalogSearchService,
  configureCatalogTransaction,
  getTaxonomy,
  saveListingInTransaction,
  type CatalogExecutor,
} from "./service";
import { previewImport } from "./import";
import { normalizeImportRow } from "./import-format";
import { contentDiff } from "./history";

export const importSettingsSchema = z.object({
  mode: z.enum(["create", "update"]).default("create"),
  decisions: z.record(z.string(), z.enum(["accept", "skip"])).default({}),
  mappings: z
    .array(
      z.object({
        kind: z.enum(["category", "area", "tag"]),
        value: z.string().trim().min(1).max(200),
        id: z.number().int().positive(),
      }),
    )
    .max(200)
    .default([]),
  columns: z.record(z.string().max(200), z.string().max(100)).default({}),
  clear: z
    .array(
      z.enum([
        "shortDescription",
        "description",
        "categoryId",
        "areaId",
        "priceMin",
        "priceMax",
        "aliases",
        "attrs",
      ]),
    )
    .max(9)
    .default([]),
  linksMode: z.enum(["append", "replace"]).default("append"),
  tagsMode: z.enum(["append", "replace"]).default("append"),
});
type Settings = z.infer<typeof importSettingsSchema>;
type PlanRow = {
  row: number;
  name: string;
  slug: string;
  id?: number;
  before?: ListingInput;
  data: ListingInput | null;
  errors: string[];
  warnings: string[];
  diff?: ReturnType<typeof contentDiff>;
};
type ImportPayload = { source: string; settings: Settings; rows: PlanRow[] };
const digestOf = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
            )
          : item,
      ),
    )
    .digest("hex");
export const asListingInput = (
  row: NonNullable<Awaited<ReturnType<typeof CatalogSearchService.detail>>>,
) =>
  listingSchema.parse({
    ...row,
    priceMin: row.priceMin === null ? null : Number(row.priceMin),
    priceMax: row.priceMax === null ? null : Number(row.priceMax),
    tagIds: row.tags.map((t) => t.id),
  });

async function importRows(
  source: string,
  settings: Settings,
  tx: CatalogExecutor,
): Promise<PlanRow[]> {
  const preview = await previewImport(source, tx, settings);
  if (settings.mode === "create") return preview.items;
  const sourceRows = parseImportSource(source, settings.columns);
  const targets = new Set<number>();
  return Promise.all(
    preview.items.map(async (item, index) => {
      const raw = normalizeImportRow(sourceRows[index]);
      if (!raw.slug?.trim())
        return { ...item, errors: ["更新必須指定既有精確 slug"] };
      const target = await CatalogSearchService.detail(
        raw.slug.trim(),
        "admin",
        tx,
      );
      if (!target || target.slug !== raw.slug.trim())
        return {
          ...item,
          errors: ["找不到既有精確 slug；不會模糊配對或建立新項目"],
        };
      const errors = item.errors.filter((error) => error !== "網址代稱已存在");
      if (targets.has(target.id)) errors.push("同批不可重複更新相同項目");
      targets.add(target.id);
      const before = asListingInput(target);
      const next: Record<string, unknown> = { ...before };
      for (const key of [
        "name",
        "shortDescription",
        "description",
        "priceMin",
        "priceMax",
        "priceCurrency",
      ])
        if (raw[key]?.trim())
          next[key] =
            key.startsWith("price") && key !== "priceCurrency"
              ? Number(raw[key])
              : raw[key];
      for (const [key, columns] of [
        ["categoryId", ["categoryId", "category"]],
        ["areaId", ["areaId", "area"]],
      ] as const)
        if (columns.some((column) => raw[column]?.trim()))
          next[key] = item.data?.[key];
      for (const key of ["attrs", "aliases"] as const)
        if (raw[key]?.trim()) next[key] = JSON.parse(raw[key]);
      const hasLinks = [
        "links",
        "linksJson",
        "website",
        "telegram",
        "instagram",
      ].some((key) => sourceRows[index][key]?.trim());
      const hasTags = ["tags", "tagSlugs", "tagIds"].some((key) =>
        sourceRows[index][key]?.trim(),
      );
      if (hasLinks && item.data) {
        if (item.data.links.some(link => link.id && !before.links.some(old => old.id === link.id))) errors.push("外部連結 ID 不屬於此項目");
      const links = item.data.links.map((link) => ({
          ...link,
          id: link.id ?? before.links.find(
            (old) =>
              old.type === link.type &&
              old.url === link.url &&
              old.label === link.label,
          )?.id,
        }));
        next.links =
          settings.linksMode === "replace"
            ? links
            : [...before.links, ...links.filter((link) => !link.id)];
      }
      if (hasTags && item.data)
        next.tagIds =
          settings.tagsMode === "replace"
            ? item.data.tagIds
            : [...new Set([...before.tagIds, ...item.data.tagIds])];
      for (const field of settings.clear)
        next[field] =
          field === "aliases"
            ? []
            : field === "attrs"
              ? {}
              : ["shortDescription", "description"].includes(field)
                ? ""
                : null;
      const parsed = listingSchema.safeParse(next);
      if (!parsed.success)
        errors.push(
          ...parsed.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
        );
      return {
        ...item,
        id: target.id,
        before,
        data: parsed.success ? parsed.data : null,
        errors,
        warnings: [],
        diff: parsed.success ? contentDiff(before, parsed.data) : {},
      };
    }),
  );
}
async function storePlan(
  actorId: number,
  kind: string,
  payload: Record<string, unknown>,
) {
  const id = randomUUID(),
    digest = digestOf(payload);
  const [plan] = await db
    .insert(catalogPlans)
    .values({
      id,
      actorId,
      kind,
      digest,
      payload,
      expiresAt: new Date(Date.now() + 86400000),
    })
    .returning();
  return plan;
}
export async function prepareTaxonomyImport(source: string, actorId: number) {
  const preview = await taxonomyImportPreview(source, db);
  return storePlan(actorId, "taxonomy", { source, preview });
}
export async function prepareImport(
  source: string,
  settings: Settings,
  actorId: number,
) {
  return db.transaction(async (tx) => {
    await configureCatalogTransaction(tx);
    const rows = await importRows(source, settings, tx);
    if (
      Object.keys(settings.decisions).some(
        (row) => !rows.some((item) => String(item.row) === row),
      )
    )
      throw new AppError("INVALID_REQUEST", "Invalid row decision");
    const payload = { source, settings, rows };
    const id = randomUUID(),
      digest = digestOf(payload);
    const [plan] = await tx
      .insert(catalogPlans)
      .values({
        id,
        actorId,
        kind: "import",
        digest,
        payload,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning();
    return plan;
  });
}
export const bulkSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.number().int().positive(),
        revision: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(200),
  patch: z
    .object({
      enabled: z.boolean().optional(),
      featured: z.boolean().optional(),
      categoryId: z.number().int().positive().nullable().optional(),
      areaId: z.number().int().positive().nullable().optional(),
      sortOrder: z.number().int().min(-1000000).max(1000000).optional(),
      addTags: z.array(z.number().int().positive()).max(50).default([]),
      removeTags: z.array(z.number().int().positive()).max(50).default([]),
    })
    .strict(),
});
export async function prepareBulk(
  input: z.infer<typeof bulkSchema>,
  actorId: number,
) {
  if (new Set(input.entries.map((e) => e.id)).size !== input.entries.length)
    throw new AppError("INVALID_REQUEST", "Duplicate target");
  const rows: PlanRow[] = [];
  for (const entry of [...input.entries].sort((a, b) => a.id - b.id)) {
    const [identity] = await db
      .select({ slug: listings.slug })
      .from(listings)
      .where(eq(listings.id, entry.id));
    const target =
      identity && (await CatalogSearchService.detail(identity.slug, "admin"));
    if (!target || target.revision !== entry.revision)
      throw new AppError("CONFLICT", "選取項目已變更，請重新載入後預覽");
    const before = asListingInput(target);
    const { addTags, removeTags, ...patch } = input.patch;
    const data = listingSchema.parse({
      ...before,
      ...patch,
      tagIds: [...new Set([...before.tagIds, ...addTags])].filter(
        (id) => !removeTags.includes(id),
      ),
    });
    rows.push({
      row: rows.length + 1,
      id: target.id,
      name: target.name,
      slug: target.slug,
      before,
      data,
      errors: [],
      warnings: [],
      diff: contentDiff(before, data),
    });
  }
  return storePlan(actorId, "bulk", { rows });
}
export async function getContentPlan(
  id: string,
  actorId: number,
  tx: CatalogExecutor = db,
) {
  const [plan] = await tx
    .select()
    .from(catalogPlans)
    .where(
      and(
        eq(catalogPlans.id, id),
        eq(catalogPlans.actorId, actorId),
        gt(catalogPlans.expiresAt, new Date()),
      ),
    );
  if (!plan) throw new AppError("NOT_FOUND", "計畫不存在或已過期；請重新預覽");
  return plan;
}
export async function recentContentPlans(actorId: number) {
  return db
    .select({
      id: catalogPlans.id,
      kind: catalogPlans.kind,
      createdAt: catalogPlans.createdAt,
      expiresAt: catalogPlans.expiresAt,
      result: catalogPlans.result,
    })
    .from(catalogPlans)
    .where(
      and(
        eq(catalogPlans.actorId, actorId),
        gt(catalogPlans.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(catalogPlans.createdAt))
    .limit(20);
}
export async function commitContentPlan(
  id: string,
  digest: string,
  actorId: number,
) {
  return db.transaction(async (tx) => {
    await configureCatalogTransaction(tx);
    await tx.execute(sql`select pg_advisory_xact_lock(724111)`);
    const plan = await getContentPlan(id, actorId, tx);
    if (plan.digest !== digest)
      throw new AppError("CONFLICT", "計畫已改變，請重新預覽");
    if (plan.result) return { ...plan.result, replayed: true };
    if (plan.kind === "taxonomy") {
      const source = String(plan.payload.source);
      const preview = await taxonomyImportPreview(source, tx);
      if (digestOf(preview) !== digestOf(plan.payload.preview))
        throw new AppError("CONFLICT", "分類內容已改變，請重新預覽");
      const created = await commitTaxonomyImport(source, tx, {
        actorId,
        operationId: id,
      });
      const result = {
        created,
        updated: 0,
        skipped: 0,
        unchanged: 0,
        affected: [],
      };
      await tx
        .update(catalogPlans)
        .set({
          result,
          payload: {},
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })
        .where(eq(catalogPlans.id, id));
      return result;
    }
    const payload = plan.payload as unknown as ImportPayload;
    let rows = payload.rows;
    if (plan.kind === "import") {
      const current = await importRows(payload.source, payload.settings, tx);
      if (digestOf(current) !== digestOf(rows))
        throw new AppError(
          "CONFLICT",
          "資料、配對或版本已改變；未寫入任何項目，請重新預覽",
        );
      rows = rows.filter(
        (row) => payload.settings.decisions[String(row.row)] !== "skip",
      );
      if (
        rows.some(
          (row) =>
            row.errors.length ||
            (row.warnings.length &&
              payload.settings.decisions[String(row.row)] !== "accept"),
        )
      )
        throw new AppError("CONFLICT", "請處理所選行的錯誤及警告後重新預覽");
    }
    if (!rows.length) throw new AppError("INVALID_REQUEST", "請至少選取一行");
    const categoryIds = rows.flatMap((row) =>
      row.data?.categoryId ? [row.data.categoryId] : [],
    );
    const areaIds = rows.flatMap((row) =>
      row.data?.areaId ? [row.data.areaId] : [],
    );
    const tagIds = rows.flatMap((row) => row.data?.tagIds ?? []);
    if (categoryIds.length)
      await tx
        .select()
        .from(categories)
        .where(inArray(categories.id, categoryIds))
        .orderBy(asc(categories.id))
        .for("share");
    if (areaIds.length)
      await tx
        .select()
        .from(areas)
        .where(inArray(areas.id, areaIds))
        .orderBy(asc(areas.id))
        .for("share");
    if (tagIds.length)
      await tx
        .select()
        .from(tags)
        .where(inArray(tags.id, tagIds))
        .orderBy(asc(tags.id))
        .for("share");
    const taxonomy = await getTaxonomy("admin", tx);
    const affected: {
      id: number;
      slug: string;
      revision: number;
      enabled: boolean;
    }[] = [];
    let created = 0,
      updated = 0,
      unchanged = 0;
    for (const row of [...rows].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
      if (!row.data) throw new AppError("CONFLICT", "Invalid plan row");
      const data = listingSchema.parse(row.data);
      if (
        (data.categoryId &&
          !taxonomy.categories.some(
            (t) => t.id === data.categoryId && t.enabled,
          )) ||
        (data.areaId &&
          !taxonomy.areas.some((t) => t.id === data.areaId && t.enabled)) ||
        data.tagIds.some(
          (id) => !taxonomy.tags.some((t) => t.id === id && t.enabled),
        )
      )
        throw new AppError("CONFLICT", "分類、地區或標籤已停用；請重新預覽");
      if (row.id) {
        const [current] = await tx
          .select()
          .from(listings)
          .where(eq(listings.id, row.id))
          .for("update");
        if (!current || current.revision !== data.revision)
          throw new AppError(
            "CONFLICT",
            "收錄版本已改變；整批未寫入，請重新預覽",
          );
        if (row.diff && !Object.keys(row.diff).length) {
          unchanged++;
          continue;
        }
      }
      const saved = await saveListingInTransaction(tx, data, row.id, {
        actorId,
        operationId: id,
      });
      affected.push({
        id: saved.id,
        slug: saved.slug,
        revision: saved.revision,
        enabled: saved.enabled,
      });
      if (row.id) updated++;
      else created++;
    }
    const result = {
      created,
      updated,
      unchanged,
      skipped: payload.rows.length - rows.length,
      rejected: 0,
      affected,
    };
    await tx
      .update(catalogPlans)
      .set({
        result,
        payload: {},
        expiresAt: new Date(Date.now() + 7 * 86400000),
      })
      .where(eq(catalogPlans.id, id));
    return { ...result, replayed: false };
  });
}

export async function matchingSelection(input: SearchInput) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    await configureCatalogTransaction(tx);
    const first = await CatalogSearchService.search(
      { ...input, page: 1, pageSize: 100 },
      "admin",
      tx,
    );
    if (first.total > 200)
      throw new AppError(
        "INVALID_REQUEST",
        "符合項目超過 200；請縮小篩選再全選",
      );
    const second =
      first.total > 100
        ? await CatalogSearchService.search(
            { ...input, page: 2, pageSize: 100 },
            "admin",
            tx,
          )
        : { items: [] };
    return [...first.items, ...second.items].map(({ id, revision, name }) => ({
      id,
      revision,
      name,
    }));
  });
}
