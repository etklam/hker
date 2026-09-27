import { sql } from "drizzle-orm";
import { db, type DB } from "@/server/db";
import { AppError } from "@/lib/errors";
import {
  readCatalogBatch,
  configureCatalogTransaction,
  getTaxonomy,
} from "./service";
import { IMPORT_LIMITS } from "./import-format";

const omit = <T extends object>(value: T, keys: (keyof T)[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key as keyof T)),
  );

export function csvCell(value: unknown, spreadsheet = true) {
  let text = value === null || value === undefined ? "" : String(value);
  // Quoting preserves CSV syntax; prefixing protects formula-like spreadsheet cells.
  if (
    spreadsheet &&
    /^[\s\p{Cf}\p{Cc}]*[=+\-@＝＋－＠]/u.test(text.normalize("NFKC"))
  )
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function serializeCsv(
  rows: Record<string, unknown>[],
  headers: string[],
  spreadsheet = true,
) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map((value) => csvCell(value, spreadsheet)).join(","))
    .join("\r\n");
}
export async function exportCatalog(
  ids: number[],
  format: "json" | "csv",
  database: DB = db,
) {
  if (
    !ids.length ||
    ids.length > IMPORT_LIMITS.rows ||
    new Set(ids).size !== ids.length
  )
    throw new AppError(
      "INVALID_REQUEST",
      "明確選取 1–200 項；大型目錄請分批匯出",
    );
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    await configureCatalogTransaction(tx);
    const rows = await readCatalogBatch({ ids }, "admin", tx);
    if (rows.length !== ids.length)
      throw new AppError("CONFLICT", "選取的內容已變更；請重新選取");
    const taxonomy = await getTaxonomy("admin", tx);
    const portable = rows.map((row) => {
      if (!row) throw new AppError("CONFLICT", "內容已變更");
      return {
        name: row.name,
        slug: row.slug,
        aliases: row.aliases,
        shortDescription: row.shortDescription,
        description: row.description,
        priceMin: row.priceMin,
        priceMax: row.priceMax,
        priceCurrency: row.priceCurrency,
        attrs: row.attrs,
        featured: row.featured,
        sortOrder: row.sortOrder,
        enabled: row.enabled,
        categorySlug: row.category?.slug ?? null,
        areaSlug: row.area?.slug ?? null,
        tagSlugs: row.tags.map((tag) => tag.slug),
        links: row.links.map(({ type, label, url, sortOrder, enabled }) => ({
          type,
          label,
          url,
          sortOrder,
          enabled,
        })),
      };
    });
    const usedCategories = new Set(
      rows.flatMap((row) => (row?.categoryId ? [row.categoryId] : [])),
    );
    const usedAreas = new Set(
      rows.flatMap((row) => (row?.areaId ? [row.areaId] : [])),
    );
    const usedTags = new Set(
      rows.flatMap((row) => row?.tags.map((tag) => tag.id) ?? []),
    );
    for (const id of usedAreas) {
      const parent = taxonomy.areas.find((area) => area.id === id)?.parentId;
      if (parent) usedAreas.add(parent);
    }
    taxonomy.navigation = taxonomy.navigation.filter(
      (row) =>
        (!row.categoryId || usedCategories.has(row.categoryId)) &&
        (!row.areaId || usedAreas.has(row.areaId)) &&
        row.tagIds.every((id) => usedTags.has(id)),
    );
    taxonomy.categories = taxonomy.categories.filter((row) =>
      usedCategories.has(row.id),
    );
    taxonomy.areas = taxonomy.areas.filter((row) => usedAreas.has(row.id));
    taxonomy.tags = taxonomy.tags.filter((row) => usedTags.has(row.id));
    taxonomy.groups = taxonomy.groups.filter((row) =>
      taxonomy.tags.some((tag) => tag.groupId === row.id),
    );
    if (
      Object.values(taxonomy).reduce(
        (total, values) => total + values.length,
        0,
      ) > 200
    )
      throw new AppError(
        "INVALID_REQUEST",
        "分類關聯超過 200 項，請縮小選取範圍",
      );
    const slugOf = (
      kind: "categories" | "areas" | "tags" | "groups",
      id: number | null,
    ) => taxonomy[kind].find((item) => item.id === id)?.slug ?? null;
    const document = {
      format: "hker-catalog",
      version: 1,
      exportedAt: new Date().toISOString(),
      listings: portable,
      taxonomy: {
        categories: taxonomy.categories.map((row) => omit(row, ["id"])),
        areas: taxonomy.areas.map((row) => ({
          ...omit(row, ["id", "parentId", "depth"]),
          parentSlug: slugOf("areas", row.parentId),
        })),
        groups: taxonomy.groups.map((row) => omit(row, ["id"])),
        tags: taxonomy.tags.map((row) => ({
          ...omit(row, ["id", "groupId"]),
          groupSlug: slugOf("groups", row.groupId),
        })),
        navigation: taxonomy.navigation.map((row) => ({
          ...omit(row, [
            "id",
            "categoryId",
            "areaId",
            "tagIds",
            "available",
            "warning",
          ]),
          categorySlug: slugOf("categories", row.categoryId),
          areaSlug: slugOf("areas", row.areaId),
          tagSlugs: row.tagIds.map((id) => slugOf("tags", id)),
        })),
      },
    };
    const body =
      format === "json"
        ? JSON.stringify(document, null, 2)
        : serializeCsv(
            portable.map((row) => ({
              ...row,
              formatVersion: "2",
              tagSlugs: row.tagSlugs.join("|"),
              aliasesJson: JSON.stringify(row.aliases),
              linksJson: JSON.stringify(row.links),
              attrsJson: JSON.stringify(row.attrs),
            })),
            [
              "formatVersion",
              "name",
              "slug",
              "categorySlug",
              "areaSlug",
              "priceMin",
              "priceMax",
              "priceCurrency",
              "tagSlugs",
              "shortDescription",
              "description",
              "linksJson",
              "aliasesJson",
              "attrsJson",
            ],
          );
    if (Buffer.byteLength(body) > IMPORT_LIMITS.bytes)
      throw new AppError(
        "INVALID_REQUEST",
        "匯出超過 500 KB；請縮小選取範圍，未截斷資料",
      );
    return body;
  });
}
