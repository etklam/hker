import { parseImportSource } from "./native-format";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, type DB } from "@/server/db";
import {
  listings,
  listingLinks,
  listingSlugAliases,
} from "@/db/schema/directory";
import { listingSchema, type ListingInput } from "@/schemas/directory";
import {
  configureCatalogTransaction,
  saveListingInTransaction,
  getTaxonomy,
  type CatalogExecutor,
} from "./service";
import { AppError } from "@/lib/errors";

import { catalogImportJobs } from "@/db/schema/directoryOperations";
import { generateListingSlug } from "@/lib/directory";

import {
  normalizeImportRow,
  importDecimal,
  resolveImportTerm,
  normalizeName,
  normalizeUrl,
  type ImportMapping,
} from "./import-format";
export {
  parseCsv,
  normalizeName,
  normalizeUrl,
  type ImportMapping,
} from "./import-format";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function previewImport(
  csv: string,
  executor: CatalogExecutor = db,
  mapping: {
    mappings?: ImportMapping[];
    columns?: Record<string, string>;
    decisions?: Record<string, "accept" | "skip">;
    mode?: "create" | "update";
  } = {},
) {
  const rows = parseImportSource(csv, mapping.columns);
  const native = csv.replace(/^\uFEFF/, "").trimStart().startsWith("{");
  const taxonomy = await getTaxonomy("admin", executor);
  const areaChoices = taxonomy.areas.map((area) => {
    const names = [area.name];
    let parentId = area.parentId;
    const seen = new Set([area.id]);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = taxonomy.areas.find((item) => item.id === parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return { ...area, path: names.join(" / ") };
  });
  const [existing, links, oldSlugs] = await Promise.all([
    executor
      .select({
        id: listings.id,
        name: listings.name,
        slug: listings.slug,
        revision: listings.revision,
        areaId: listings.areaId,
      })
      .from(listings),
    executor
      .select({ url: listingLinks.url, listingId: listingLinks.listingId })
      .from(listingLinks),
    executor.select({ slug: listingSlugAliases.slug }).from(listingSlugAliases),
  ]);
  const names = new Set(existing.map((r) => normalizeName(r.name)));
  const slugs = new Set([...existing, ...oldSlugs].map((r) => r.slug));
  const urls = new Set(links.map((r) => normalizeUrl(r.url)));
  const items = rows.map((source, index) => {
    let row = source;
    if (mapping.mode === "update" && !source.name?.trim())
      row = {
        ...source,
        name:
          existing.find((item) => item.slug === source.slug?.trim())?.name ??
          "",
      };
    const errors: string[] = [],
      warnings: string[] = [];
    const resolve = (
      value: string | undefined,
      choices: { id: number; slug: string; name: string; enabled: boolean }[],
      label: string,
    ) => {
      if (!value?.trim()) return null;
      const kind =
        label === "分類" ? "category" : label === "地區" ? "area" : "tag";
      const chosen = mapping.mappings?.find(
        (item) => item.kind === kind && item.value.trim() === value.trim(),
      );
      const result = chosen
        ? {
            id: choices.some((item) => item.id === chosen.id && item.enabled)
              ? chosen.id
              : null,
            state: "invalid-mapping",
          }
        : resolveImportTerm(value, choices);
      if (native && result.state === "disabled" && "candidates" in result) {
        warnings.push(`${label}「${value}」已停用；接受後只保留關聯，不會啟用分類或發佈收錄`);
        return result.candidates[0].id;
      }
      if (result.id === null)
        errors.push(`${label}：找不到或名稱不唯一 (${value}; ${result.state})`);
      return result.id;
    };
    const numeric = (key: string) =>
      row[key]?.trim() ? Number(row[key]) : null;
    let slug = row.slug?.trim();
    if (!slug) {
      const base = generateListingSlug(row.name ?? "");
      slug = base;
      let suffix = 2;
      while (slugs.has(slug)) slug = `${base}-${suffix++}`;
    }
    let data: ListingInput | null = null;
    try {
      row = normalizeImportRow(row);
      const parsed = listingSchema.safeParse({
        ...row,
        slug,
        enabled: false,
        featured: row.featured === "true",
        sortOrder: row.sortOrder ? Number(row.sortOrder) : 0,
        categoryId: row.categoryId?.trim()
          ? numeric("categoryId")
          : resolve(row.category, taxonomy.categories, "分類"),
        areaId: row.areaId?.trim()
          ? numeric("areaId")
          : resolve(row.area, areaChoices, "地區"),
        tagIds: row.tagIds?.trim()
          ? row.tagIds.split("|").map(Number)
          : (row.tags
              ?.split("|")
              .filter(Boolean)
              .map((v) => resolve(v, taxonomy.tags, "標籤")) ?? []),
        priceMin: importDecimal(row.priceMin, "priceMin"),
        priceMax: importDecimal(row.priceMax, "priceMax"),
        priceCurrency: row.priceCurrency || "HKD",
        aliases: row.aliases ? JSON.parse(row.aliases) : [],
        attrs: row.attrs ? JSON.parse(row.attrs) : {},
        links: [
          ...(row.links ? JSON.parse(row.links) : []),
          ...(row.website
            ? [{ type: "website", label: "官方網站", url: row.website }]
            : []),
        ],
      });
      if (!parsed.success)
        errors.push(
          ...parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`,
          ),
        );
      else {
        data = parsed.data;
        if (mapping.mode !== "update" && data.links.some((l) => l.id !== undefined))
          errors.push("匯入連結不可指定既有 ID");
        if (
          data.categoryId &&
          !taxonomy.categories.some(
            (c) => c.id === data!.categoryId && (c.enabled || native),
          )
        )
          errors.push("分類 ID 不存在或已停用");
        if (
          data.areaId &&
          !taxonomy.areas.some((c) => c.id === data!.areaId && (c.enabled || native))
        )
          errors.push("地區 ID 不存在或已停用");
        if (
          data.tagIds.some(
            (id) => !taxonomy.tags.some((t) => t.id === id && (t.enabled || native)),
          )
        )
          errors.push("標籤 ID 不存在或已停用");
        if (slugs.has(slug)) errors.push("網址代稱已存在");
        if (names.has(normalizeName(data.name)))
          warnings.push("名稱與既有或同批收錄相同，請確認是否不同分店／項目");
        if (data.links.some((l) => urls.has(normalizeUrl(l.url))))
          warnings.push("外部連結與既有或同批收錄相同");
        if (mapping.decisions?.[String(index + 2)] !== "skip") {
          names.add(normalizeName(data.name));
          data.links.forEach((l) => urls.add(normalizeUrl(l.url)));
        }
        if (
          new Set(data.links.map((link) => `${link.type}:${link.url}`)).size !==
          data.links.length
        )
          warnings.push("此收錄含相同類型及 URL 的重複連結；確認後將保留");
      }
    } catch (error) {
      errors.push(
        error instanceof AppError
          ? error.message
          : "links、aliases 或 attrs JSON 格式不正確",
      );
    }
    if (mapping.decisions?.[String(index + 2)] !== "skip") slugs.add(slug);
    const candidates = data
      ? existing
          .filter(
            (candidate) =>
              normalizeName(candidate.name) === normalizeName(data!.name) ||
              links.some(
                (link) =>
                  link.listingId === candidate.id &&
                  data!.links.some(
                    (proposed) =>
                      normalizeUrl(proposed.url) === normalizeUrl(link.url),
                  ),
              ),
          )
          .slice(0, 10)
          .map((candidate) => ({
            ...candidate,
            area:
              taxonomy.areas.find((area) => area.id === candidate.areaId)
                ?.name ?? null,
          }))
      : [];
    return {
      candidates,
      row: index + 2,
      name: row.name,
      slug,
      errors,
      warnings,
      data,
    };
  });
  return {
    digest: hash(JSON.stringify({ csv, items })),
    items,
    valid: items.every((i) => !i.errors.length),
  };
}
export type ImportOptions = {
  requestKey: string;
  actorId: number;
  decisions?: Record<string, "accept" | "skip">;
};
export async function confirmImport(
  csv: string,
  digest: string,
  options: ImportOptions,
  database: DB = db,
) {
  const decisions = options.decisions ?? {};
  const fingerprint = hash(
    JSON.stringify({ mode: "draft-create", csv, digest, decisions }),
  );
  if (!Number.isSafeInteger(options.actorId) || options.actorId <= 0)
    throw new AppError("INVALID_REQUEST", "Invalid import actor");
  if (!options.requestKey || options.requestKey.length > 100)
    throw new AppError("INVALID_REQUEST", "Invalid import key");
  const key = hash(`${options.actorId}:${options.requestKey}`);
  return database.transaction(async (tx) => {
    await configureCatalogTransaction(tx);
    // Share the listing namespace lock with interactive saves, using this transaction only.
    await tx.execute(sql`select pg_advisory_xact_lock(724111)`);
    const [receipt] = await tx
      .select()
      .from(catalogImportJobs)
      .where(eq(catalogImportJobs.key, key));
    if (receipt) {
      if (receipt.digest !== fingerprint)
        throw new AppError("CONFLICT", "匯入識別碼已用於不同內容");
      return { ...receipt.result, replayed: true };
    }
    const preview = await previewImport(csv, tx);
    if (preview.digest !== digest)
      throw new AppError("CONFLICT", "資料或驗證結果已改變，請重新預覽");
    const selected = preview.items.filter(
      (i) => decisions[String(i.row)] !== "skip",
    );
    if (
      Object.keys(decisions).some(
        (row) => !preview.items.some((i) => String(i.row) === row),
      )
    )
      throw new AppError("INVALID_REQUEST", "Invalid row decision");
    if (
      selected.some(
        (i) =>
          i.errors.length ||
          (i.warnings.length && decisions[String(i.row)] !== "accept"),
      )
    )
      throw new AppError(
        "CONFLICT",
        "請修正錯誤，並明確接受或略過警告行；尚未匯入任何項目",
      );
    const ids: number[] = [];
    for (const item of selected) {
      const row = await saveListingInTransaction(tx, item.data!, undefined, {
        actorId: options.actorId,
        operationId: key,
      });
      ids.push(row.id);
    }
    const result = {
      imported: ids.length,
      skipped: preview.items.length - ids.length,
      ids,
    };
    await tx
      .insert(catalogImportJobs)
      .values({ key, digest: fingerprint, result });
    return { ...result, replayed: false };
  });
}
