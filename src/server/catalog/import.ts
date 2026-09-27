import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, type DB } from "@/server/db";
import {
  listings,
  listingLinks,
  listingTags,
  listingSlugAliases,
} from "@/db/schema/directory";
import { listingSchema, type ListingInput } from "@/schemas/directory";
import {
  configureCatalogTransaction,
  getTaxonomy,
  type CatalogExecutor,
} from "./service";
import { AppError } from "@/lib/errors";

import { catalogImportJobs } from "@/db/schema/directoryOperations";
import { generateListingSlug } from "@/lib/directory";

export function parseCsv(text: string): Record<string, string>[] {
  if (Buffer.byteLength(text, "utf8") > 500000)
    throw new AppError("INVALID_REQUEST", "CSV must be under 500 KB");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed)
        throw new AppError("INVALID_REQUEST", "Unexpected CSV quote");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed)
        throw new AppError(
          "INVALID_REQUEST",
          "Unexpected text after quoted field",
        );
      cell += c;
    }
  }
  if (quoted) throw new AppError("INVALID_REQUEST", "Unclosed CSV quote");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > 201)
    throw new AppError(
      "INVALID_REQUEST",
      "CSV requires a header and 1–200 rows",
    );
  const headers = rows.shift()!.map((h) => h.replace(/^\uFEFF/, "").trim());
  if (
    headers.length > 24 ||
    headers.some((header) => Buffer.byteLength(header, "utf8") > 200)
  )
    throw new AppError("INVALID_REQUEST", "CSV has too many or oversized columns");
  if (new Set(headers).size !== headers.length || !headers.includes("name"))
    throw new AppError(
      "INVALID_REQUEST",
      "Unique headers including name are required",
    );
  const allowed = [
    "name",
    "slug",
    "shortDescription",
    "description",
    "priceMin",
    "priceMax",
    "priceCurrency",
    "categoryId",
    "areaId",
    "tagIds",
    "website",
    "category",
    "area",
    "tags",
    "links",
    "aliases",
    "attrs",
  ];
  if (headers.some((h) => !allowed.includes(h)))
    throw new AppError("INVALID_REQUEST", "Unsupported CSV column");
  return rows.map((r) => {
    if (
      r.some((cell) => Buffer.byteLength(cell, "utf8") > 24000) ||
      r.length !== headers.length
    )
      throw new AppError("INVALID_REQUEST", "CSV column count mismatch");
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
export const normalizeName = (name: string) =>
  name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").trim();
export function normalizeUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return value;
  }
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function previewImport(
  csv: string,
  executor: CatalogExecutor = db,
) {
  const rows = parseCsv(csv);
  const taxonomy = await getTaxonomy("admin", executor);
  const [existing, links, oldSlugs] = await Promise.all([
    executor
      .select({ name: listings.name, slug: listings.slug })
      .from(listings),
    executor.select({ url: listingLinks.url }).from(listingLinks),
    executor.select({ slug: listingSlugAliases.slug }).from(listingSlugAliases),
  ]);
  const names = new Set(existing.map((r) => normalizeName(r.name)));
  const slugs = new Set([...existing, ...oldSlugs].map((r) => r.slug));
  const urls = new Set(links.map((r) => normalizeUrl(r.url)));
  const items = rows.map((row, index) => {
    const errors: string[] = [],
      warnings: string[] = [];
    const resolve = (
      value: string | undefined,
      choices: { id: number; slug: string; name: string; enabled: boolean }[],
      label: string,
    ) => {
      if (!value?.trim()) return null;
      const matches = choices.filter(
        (c) =>
          c.enabled &&
          (c.slug === value.trim() ||
            normalizeName(c.name) === normalizeName(value)),
      );
      const unique = [...new Set(matches.map((c) => c.id))];
      if (unique.length !== 1)
        errors.push(`${label}：找不到或名稱不唯一 (${value})`);
      return unique[0] ?? null;
    };
    const numeric = (key: string) =>
      row[key]?.trim() ? Number(row[key]) : null;
    let slug = row.slug?.trim();
    if (!slug) {
      const base = generateListingSlug(row.name);
      slug = base;
      let suffix = 2;
      while (slugs.has(slug)) slug = `${base}-${suffix++}`;
    }
    let data: ListingInput | null = null;
    try {
      const parsed = listingSchema.safeParse({
        ...row,
        slug,
        enabled: false,
        categoryId: row.categoryId?.trim()
          ? numeric("categoryId")
          : resolve(row.category, taxonomy.categories, "分類"),
        areaId: row.areaId?.trim()
          ? numeric("areaId")
          : resolve(row.area, taxonomy.areas, "地區"),
        tagIds: row.tagIds?.trim()
          ? row.tagIds.split("|").map(Number)
          : (row.tags
              ?.split("|")
              .filter(Boolean)
              .map((v) => resolve(v, taxonomy.tags, "標籤")) ?? []),
        priceMin: numeric("priceMin"),
        priceMax: numeric("priceMax"),
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
        if (data.links.some((l) => l.id !== undefined))
          errors.push("匯入連結不可指定既有 ID");
        if (
          data.categoryId &&
          !taxonomy.categories.some(
            (c) => c.id === data!.categoryId && c.enabled,
          )
        )
          errors.push("分類 ID 不存在或已停用");
        if (
          data.areaId &&
          !taxonomy.areas.some((c) => c.id === data!.areaId && c.enabled)
        )
          errors.push("地區 ID 不存在或已停用");
        if (
          data.tagIds.some(
            (id) => !taxonomy.tags.some((t) => t.id === id && t.enabled),
          )
        )
          errors.push("標籤 ID 不存在或已停用");
        if (slugs.has(slug)) errors.push("網址代稱已存在");
        if (names.has(normalizeName(data.name)))
          warnings.push("名稱與既有或同批收錄相同，請確認是否不同分店／項目");
        if (data.links.some((l) => urls.has(normalizeUrl(l.url))))
          warnings.push("外部連結與既有或同批收錄相同");
        names.add(normalizeName(data.name));
        data.links.forEach((l) => urls.add(normalizeUrl(l.url)));
      }
    } catch {
      errors.push("links、aliases 或 attrs JSON 格式不正確");
    }
    slugs.add(slug);
    return { row: index + 2, name: row.name, slug, errors, warnings, data };
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
      const { tagIds, links, ...data } = item.data!;
      const [row] = await tx
        .insert(listings)
        .values({
          ...data,
          revision: undefined,
          priceMin: data.priceMin?.toFixed(2) ?? null,
          priceMax: data.priceMax?.toFixed(2) ?? null,
        })
        .returning({ id: listings.id });
      ids.push(row.id);
      if (links.length)
        await tx
          .insert(listingLinks)
          .values(
            links.map((link) => ({
              ...link,
              id: undefined,
              listingId: row.id,
            })),
          );
      if (tagIds.length)
        await tx
          .insert(listingTags)
          .values(
            [...new Set(tagIds)].map((tagId) => ({ tagId, listingId: row.id })),
          );
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
