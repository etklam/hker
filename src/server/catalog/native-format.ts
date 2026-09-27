import { z } from "zod";
import { listingSchema, taxonomySchemas } from "@/schemas/directory";
import { AppError } from "@/lib/errors";
import { IMPORT_LIMITS, parseCsv } from "./import-format";
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);
const taxonomy = z.object({
  categories: z.array(taxonomySchemas.categories).max(200),
  groups: z.array(taxonomySchemas.groups).max(200),
  areas: z
    .array(
      taxonomySchemas.areas
        .omit({ parentId: true })
        .extend({ parentSlug: slug.nullable() }),
    )
    .max(200),
  tags: z
    .array(
      taxonomySchemas.tags
        .omit({ groupId: true })
        .extend({ groupSlug: slug.nullable() }),
    )
    .max(200),
  navigation: z
    .array(
      z.object({
        label: z.string().max(100),
        placement: z.enum(["public", "bot", "both"]),
        icon: z.string().nullable(),
        categorySlug: slug.nullable(),
        areaSlug: slug.nullable(),
        tagSlugs: z.array(slug).max(20),
        priceMin: z.union([z.string(), z.number()]).nullable(),
        priceMax: z.union([z.string(), z.number()]).nullable(),
        matchMode: z.enum(["and", "or"]),
        enabled: z.boolean(),
        sortOrder: z.number().int(),
      }),
    )
    .max(200),
});
export const nativeCatalogSchema = z.object({
  format: z.literal("hker-catalog"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  listings: z
    .array(
      z
        .object(listingSchema.shape)
        .omit({
          categoryId: true,
          areaId: true,
          tagIds: true,
          revision: true,
          priceMin: true,
          priceMax: true,
        })
        .extend({
          priceMin: z.union([z.string(), z.number()]).nullable(),
          priceMax: z.union([z.string(), z.number()]).nullable(),
          categorySlug: slug.nullable(),
          areaSlug: slug.nullable(),
          tagSlugs: z.array(slug).max(50),
        }),
    )
    .min(1)
    .max(IMPORT_LIMITS.rows),
  taxonomy,
});
export function parseNativeCatalog(source: string) {
  if (Buffer.byteLength(source) > IMPORT_LIMITS.bytes)
    throw new AppError(
      "INVALID_REQUEST",
      "File exceeds 500 KB; split the selected scope",
    );
  const parsed = nativeCatalogSchema.safeParse(
    JSON.parse(source.replace(/^\uFEFF/, "")),
  );
  if (!parsed.success)
    throw new AppError(
      "INVALID_REQUEST",
      `Native catalog version/schema invalid: ${parsed.error.issues
        .slice(0, 5)
        .map((issue) => issue.path.join("."))
        .join(", ")}`,
    );
  if (
    Object.values(parsed.data.taxonomy).reduce(
      (count, rows) => count + rows.length,
      0,
    ) > 200
  )
    throw new AppError(
      "INVALID_REQUEST",
      "Taxonomy exceeds 200 items; split the export scope",
    );
  return parsed.data;
}
export function parseImportSource(
  source: string,
  columns: Record<string, string> = {},
): Record<string, string>[] {
  if (
    !source
      .replace(/^\uFEFF/, "")
      .trimStart()
      .startsWith("{")
  )
    return parseCsv(source, columns);
  return parseNativeCatalog(source).listings.map((row) => ({
    formatVersion: "2",
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    categorySlug: row.categorySlug ?? "",
    areaSlug: row.areaSlug ?? "",
    tagSlugs: row.tagSlugs.join("|"),
    priceMin: row.priceMin === null ? "" : String(row.priceMin),
    priceMax: row.priceMax === null ? "" : String(row.priceMax),
    priceCurrency: row.priceCurrency,
    linksJson: JSON.stringify(
      row.links.map(({ type, label, url, sortOrder, enabled }) => ({
        type,
        label,
        url,
        sortOrder,
        enabled,
      })),
    ),
    aliasesJson: JSON.stringify(row.aliases),
    attrsJson: JSON.stringify(row.attrs),
    featured: String(row.featured),
    sortOrder: String(row.sortOrder),
  }));
}
