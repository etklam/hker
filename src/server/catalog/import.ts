import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { listings, listingLinks, listingTags } from "@/db/schema/directory";
import { listingSchema, type ListingInput } from "@/schemas/directory";
import { getTaxonomy } from "./service";
import { AppError } from "@/lib/errors";

export function parseCsv(text: string): Record<string, string>[] {
  if (text.length > 500000)
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
    new Set(headers).size !== headers.length ||
    !headers.includes("name") ||
    !headers.includes("slug")
  )
    throw new AppError(
      "INVALID_REQUEST",
      "Unique headers including name and slug are required",
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
  ];
  if (headers.some((h) => !allowed.includes(h)))
    throw new AppError("INVALID_REQUEST", "Unsupported CSV column");
  return rows.map((r) => {
    if (r.length !== headers.length)
      throw new AppError("INVALID_REQUEST", "CSV column count mismatch");
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
export const normalizeName = (name: string) =>
  name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").trim();
export function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}
function dataFromRow(row: Record<string, string>) {
  const numeric = (key: string) => (row[key]?.trim() ? Number(row[key]) : null);
  return listingSchema.safeParse({
    ...row,
    categoryId: numeric("categoryId"),
    areaId: numeric("areaId"),
    priceMin: numeric("priceMin"),
    priceMax: numeric("priceMax"),
    priceCurrency: row.priceCurrency || "HKD",
    tagIds: row.tagIds ? row.tagIds.split("|").map(Number) : [],
    enabled: false,
    links: row.website
      ? [{ type: "website", label: "官方網站", url: row.website }]
      : [],
  });
}
export async function previewImport(csv: string) {
  const rows = parseCsv(csv);
  const taxonomy = await getTaxonomy("admin");
  const [existing, links] = await Promise.all([
    db.select({ name: listings.name, slug: listings.slug }).from(listings),
    db.select({ url: listingLinks.url }).from(listingLinks),
  ]);
  const names = new Set(existing.map((r) => normalizeName(r.name))),
    slugs = new Set(existing.map((r) => r.slug)),
    urls = new Set(links.map((r) => normalizeUrl(r.url)));
  const items = rows.map((row, index) => {
    const parsed = dataFromRow(row);
    const errors: string[] = [];
    if (!parsed.success)
      errors.push(
        ...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
    else {
      if (
        parsed.data.categoryId &&
        !taxonomy.categories.some((c) => c.id === parsed.data.categoryId)
      )
        errors.push("Unknown category");
      if (
        parsed.data.areaId &&
        !taxonomy.areas.some((a) => a.id === parsed.data.areaId)
      )
        errors.push("Unknown area");
      if (
        parsed.data.tagIds.some((id) => !taxonomy.tags.some((t) => t.id === id))
      )
        errors.push("Unknown tag");
      if (names.has(normalizeName(parsed.data.name)))
        errors.push("Duplicate normalized name");
      if (slugs.has(parsed.data.slug)) errors.push("Duplicate slug");
      for (const link of parsed.data.links)
        if (urls.has(normalizeUrl(link.url))) errors.push("Duplicate URL");
      names.add(normalizeName(parsed.data.name));
      slugs.add(parsed.data.slug);
      for (const link of parsed.data.links) urls.add(normalizeUrl(link.url));
    }
    return {
      row: index + 2,
      name: row.name,
      slug: row.slug,
      errors,
      data: parsed.success ? parsed.data : null,
    };
  });
  return {
    digest: createHash("sha256").update(csv).digest("hex"),
    items,
    valid: items.every((i) => !i.errors.length),
  };
}
export async function confirmImport(csv: string, digest: string) {
  if (createHash("sha256").update(csv).digest("hex") !== digest)
    throw new AppError("INVALID_REQUEST", "CSV changed; preview again");
  return db.transaction(async (tx) => {
    // Serialize catalog writes while duplicate checks and the import commit run.
    await tx.execute(
      sql`lock table directory_listings, directory_listing_links in share row exclusive mode`,
    );
    const preview = await previewImport(csv);
    if (!preview.valid)
      throw new AppError(
        "CONFLICT",
        "Duplicates or invalid rows found. Preview again; no rows imported.",
      );
    for (const item of preview.items) {
      const { tagIds, links, ...data } = item.data as ListingInput;
      const [row] = await tx
        .insert(listings)
        .values({
          ...data,
          priceMin: data.priceMin?.toFixed(2) ?? null,
          priceMax: data.priceMax?.toFixed(2) ?? null,
        })
        .returning();
      if (links.length)
        await tx
          .insert(listingLinks)
          .values(links.map((link) => ({ ...link, listingId: row.id })));
      if (tagIds.length)
        await tx
          .insert(listingTags)
          .values(
            [...new Set(tagIds)].map((tagId) => ({ tagId, listingId: row.id })),
          );
    }
    return { imported: preview.items.length };
  });
}
