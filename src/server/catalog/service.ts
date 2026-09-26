import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import * as s from "@/db/schema/directory";
import {
  listingSchema,
  searchSchema,
  taxonomySchemas,
  type SearchInput,
  type TaxonomyKind,
} from "@/schemas/directory";
import { parseBody } from "@/schemas/parse-body";
import { AppError } from "@/lib/errors";

export type Audience = "public" | "bot" | "admin";
export const publicVisibility = () => eq(s.listings.enabled, true);
const tables = {
  categories: s.categories,
  areas: s.areas,
  tags: s.tags,
  groups: s.tagGroups,
  navigation: s.navigationPresets,
};
function tagVisibility(audience: Audience): SQL {
  return audience === "admin"
    ? sql`true`
    : and(
        eq(s.tags.enabled, true),
        audience === "bot"
          ? eq(s.tags.botVisible, true)
          : eq(s.tags.publicVisible, true),
      )!;
}
export async function getTaxonomy(audience: Audience = "public") {
  const [categories, areas, tags, groups, navigation, aliases, presetTags] =
    await Promise.all([
      db
        .select()
        .from(s.categories)
        .where(
          audience === "admin" ? undefined : eq(s.categories.enabled, true),
        )
        .orderBy(asc(s.categories.sortOrder), asc(s.categories.id)),
      db
        .select()
        .from(s.areas)
        .where(audience === "admin" ? undefined : eq(s.areas.enabled, true))
        .orderBy(asc(s.areas.sortOrder), asc(s.areas.id)),
      db
        .select()
        .from(s.tags)
        .where(tagVisibility(audience))
        .orderBy(asc(s.tags.sortOrder), asc(s.tags.id)),
      db
        .select()
        .from(s.tagGroups)
        .where(
          audience === "admin"
            ? undefined
            : and(
                eq(s.tagGroups.enabled, true),
                audience === "bot"
                  ? eq(s.tagGroups.botVisible, true)
                  : eq(s.tagGroups.publicVisible, true),
              ),
        )
        .orderBy(asc(s.tagGroups.sortOrder)),
      db
        .select()
        .from(s.navigationPresets)
        .where(
          audience === "admin"
            ? undefined
            : and(
                eq(s.navigationPresets.enabled, true),
                inArray(s.navigationPresets.placement, [audience, "both"]),
              ),
        )
        .orderBy(asc(s.navigationPresets.sortOrder)),
      audience === "admin"
        ? db.select().from(s.tagAliases)
        : Promise.resolve([]),
      db.select().from(s.navigationPresetTags),
    ]);
  return {
    categories,
    areas,
    tags: tags.map((t) => ({
      ...t,
      aliases: aliases.filter((a) => a.tagId === t.id).map((a) => a.alias),
    })),
    groups,
    navigation: navigation
      .map((p) => ({
        ...p,
        tagIds: presetTags
          .filter((t) => t.presetId === p.id)
          .map((t) => t.tagId),
      }))
      .filter(
        (p) =>
          audience === "admin" ||
          ((!p.categoryId || categories.some((c) => c.id === p.categoryId)) &&
            (!p.areaId || areas.some((a) => a.id === p.areaId)) &&
            p.tagIds.every((id) =>
              tags.some((t) => t.id === id && t.filterable),
            )),
      ),
  };
}
export type Taxonomy = Awaited<ReturnType<typeof getTaxonomy>>;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
export function buildSearchWhere(
  input: ReturnType<typeof searchSchema.parse>,
  audience: Audience,
): SQL {
  const conditions: SQL[] = [
    audience === "admin" ? sql`true` : publicVisibility(),
  ];
  if (audience === "admin" && input.status !== "all")
    conditions.push(eq(s.listings.enabled, input.status === "enabled"));
  if (input.featured !== undefined)
    conditions.push(eq(s.listings.featured, input.featured));
  if (input.categoryId) {
    conditions.push(eq(s.listings.categoryId, input.categoryId));
    if (audience !== "admin")
      conditions.push(
        sql`exists (select 1 from ${s.categories} where ${s.categories.id} = ${input.categoryId} and ${s.categories.enabled})`,
      );
  }
  if (input.areaId && audience !== "admin")
    conditions.push(
      sql`exists (select 1 from ${s.areas} where ${s.areas.id} = ${input.areaId} and ${s.areas.enabled})`,
    );
  if (input.areaId)
    conditions.push(
      sql`${s.listings.areaId} in (with recursive descendants as (select id from directory_areas where id = ${input.areaId} union select a.id from directory_areas a join descendants d on a.parent_id = d.id) select id from descendants)`,
    );
  if (input.priceMin !== null || input.priceMax !== null) {
    conditions.push(
      sql`(${s.listings.priceMin} is not null or ${s.listings.priceMax} is not null)`,
    );
    conditions.push(eq(s.listings.priceCurrency, "HKD"));
    if (input.priceMin !== null)
      conditions.push(
        sql`(${s.listings.priceMax} is null or ${s.listings.priceMax} >= ${input.priceMin})`,
      );
    if (input.priceMax !== null)
      conditions.push(
        sql`(${s.listings.priceMin} is null or ${s.listings.priceMin} <= ${input.priceMax})`,
      );
  }
  const ids = [...new Set(input.tagIds)];
  if (ids.length) {
    const matching = sql`select count(distinct ${s.listingTags.tagId}) from ${s.listingTags} join ${s.tags} on ${s.tags.id} = ${s.listingTags.tagId} where ${s.listingTags.listingId} = ${s.listings.id} and ${inArray(s.tags.id, ids)} and ${tagVisibility(audience)} and ${audience === "admin" ? sql`true` : eq(s.tags.filterable, true)}`;
    conditions.push(
      input.tagMatchMode === "and"
        ? sql`(${matching}) = ${ids.length}`
        : sql`(${matching}) > 0`,
    );
  }
  if (input.query) {
    const pattern = `%${escapeLike(input.query)}%`;
    conditions.push(sql`(
      to_tsvector('simple', ${s.listings.name} || ' ' || ${s.listings.shortDescription} || ' ' || ${s.listings.description}) @@ plainto_tsquery('simple', ${input.query})
      or ${s.listings.name} ilike ${pattern} or ${s.listings.shortDescription} ilike ${pattern} or ${s.listings.description} ilike ${pattern}
      or exists (select 1 from ${s.categories} where ${s.categories.id} = ${s.listings.categoryId} and ${s.categories.enabled} and ${s.categories.name} ilike ${pattern})
      or exists (select 1 from ${s.listingTags} join ${s.tags} on ${s.tags.id} = ${s.listingTags.tagId} where ${s.listingTags.listingId} = ${s.listings.id} and ${tagVisibility(audience)} and (${s.tags.name} ilike ${pattern} or exists (select 1 from ${s.tagAliases} where ${s.tagAliases.tagId} = ${s.tags.id} and ${s.tagAliases.alias} ilike ${pattern})))
    )`);
  }
  return and(...conditions)!;
}
async function hydrate(
  rows: (typeof s.listings.$inferSelect)[],
  audience: Audience,
) {
  const taxonomy = await getTaxonomy(audience);
  const ids = rows.map((r) => r.id);
  const [links, relations] = ids.length
    ? await Promise.all([
        db
          .select()
          .from(s.listingLinks)
          .where(
            and(
              inArray(s.listingLinks.listingId, ids),
              audience === "admin"
                ? undefined
                : eq(s.listingLinks.enabled, true),
            ),
          )
          .orderBy(asc(s.listingLinks.sortOrder), asc(s.listingLinks.id)),
        db
          .select()
          .from(s.listingTags)
          .where(inArray(s.listingTags.listingId, ids)),
      ])
    : [[], []];
  return rows.map((row) => ({
    ...row,
    category: taxonomy.categories.find((c) => c.id === row.categoryId) ?? null,
    area: taxonomy.areas.find((a) => a.id === row.areaId) ?? null,
    tags: taxonomy.tags.filter((t) =>
      relations.some((r) => r.listingId === row.id && r.tagId === t.id),
    ),
    links: links.filter((l) => l.listingId === row.id),
  }));
}
export type CatalogListing = Awaited<ReturnType<typeof hydrate>>[number];
export const CatalogSearchService = {
  async search(raw: SearchInput = {}, audience: Audience = "public") {
    const input = parseBody(raw, searchSchema);
    const where = buildSearchWhere(input, audience);
    const rank = sql`ts_rank(to_tsvector('simple', ${s.listings.name} || ' ' || ${s.listings.description}), plainto_tsquery('simple', ${input.query}))`;
    const order =
      input.sort === "newest"
        ? [desc(s.listings.createdAt)]
        : input.sort === "price-asc"
          ? [
              sql`coalesce(${s.listings.priceMin}, ${s.listings.priceMax}) asc nulls last`,
            ]
          : input.sort === "price-desc"
            ? [
                sql`coalesce(${s.listings.priceMax}, ${s.listings.priceMin}) desc nulls last`,
              ]
            : input.sort === "relevance" && input.query
              ? [desc(rank)]
              : [asc(s.listings.sortOrder)];
    const [rows, [count]] = await Promise.all([
      db
        .select()
        .from(s.listings)
        .where(where)
        .orderBy(...order, asc(s.listings.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.listings)
        .where(where),
    ]);
    return {
      items: await hydrate(rows, audience),
      total: count.total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(count.total / input.pageSize),
    };
  },
  async detail(slug: string, audience: Audience = "public") {
    const rows = await db
      .select()
      .from(s.listings)
      .where(
        and(
          eq(s.listings.slug, slug),
          audience === "admin" ? undefined : publicVisibility(),
        ),
      )
      .limit(1);
    return (await hydrate(rows, audience))[0] ?? null;
  },
};
export async function saveListing(raw: unknown, id?: number) {
  const { links, tagIds, ...data } = parseBody(raw, listingSchema);
  return db.transaction(async (tx) => {
    const values = {
      ...data,
      priceMin: data.priceMin?.toFixed(2) ?? null,
      priceMax: data.priceMax?.toFixed(2) ?? null,
      updatedAt: new Date(),
    };
    const [row] = id
      ? await tx
          .update(s.listings)
          .set(values)
          .where(eq(s.listings.id, id))
          .returning()
      : await tx.insert(s.listings).values(values).returning();
    if (!row) throw new AppError("NOT_FOUND", "Listing not found");
    await tx.delete(s.listingLinks).where(eq(s.listingLinks.listingId, row.id));
    await tx.delete(s.listingTags).where(eq(s.listingTags.listingId, row.id));
    if (links.length)
      await tx
        .insert(s.listingLinks)
        .values(links.map((link) => ({ ...link, listingId: row.id })));
    if (tagIds.length)
      await tx
        .insert(s.listingTags)
        .values(
          [...new Set(tagIds)].map((tagId) => ({ listingId: row.id, tagId })),
        );
    return row;
  });
}
export async function deleteListing(id: number) {
  const rows = await db
    .delete(s.listings)
    .where(eq(s.listings.id, id))
    .returning({ id: s.listings.id });
  if (!rows.length) throw new AppError("NOT_FOUND", "Listing not found");
}
export async function saveTaxonomy(
  kind: TaxonomyKind,
  raw: unknown,
  id?: number,
) {
  if (kind === "areas") {
    const data = parseBody(raw, taxonomySchemas.areas);
    // Serialize hierarchy edits to prevent concurrent cycle creation.
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(724110)`);
      if (id && data.parentId) {
        const rows = await tx.select().from(s.areas);
        let parent: number | null = data.parentId;
        const seen = new Set<number>([id]);
        while (parent) {
          if (seen.has(parent))
            throw new AppError(
              "INVALID_REQUEST",
              "Area hierarchy cannot contain a cycle",
            );
          seen.add(parent);
          parent = rows.find((a) => a.id === parent)?.parentId ?? null;
        }
      }
      const [row] = id
        ? await tx
            .update(s.areas)
            .set(data)
            .where(eq(s.areas.id, id))
            .returning()
        : await tx.insert(s.areas).values(data).returning();
      if (!row) throw new AppError("NOT_FOUND", "Area not found");
      return row;
    });
  }
  if (kind === "tags") {
    const { aliases, ...data } = parseBody(raw, taxonomySchemas.tags);
    return db.transaction(async (tx) => {
      const [row] = id
        ? await tx.update(s.tags).set(data).where(eq(s.tags.id, id)).returning()
        : await tx.insert(s.tags).values(data).returning();
      if (!row) throw new AppError("NOT_FOUND", "Tag not found");
      await tx.delete(s.tagAliases).where(eq(s.tagAliases.tagId, row.id));
      if (aliases.length)
        await tx
          .insert(s.tagAliases)
          .values(
            [...new Set(aliases)].map((alias) => ({ tagId: row.id, alias })),
          );
      return row;
    });
  }
  if (kind === "navigation") {
    const { tagIds, ...data } = parseBody(raw, taxonomySchemas.navigation);
    const values = {
      ...data,
      priceMin: data.priceMin?.toFixed(2) ?? null,
      priceMax: data.priceMax?.toFixed(2) ?? null,
    };
    return db.transaction(async (tx) => {
      const [row] = id
        ? await tx
            .update(s.navigationPresets)
            .set(values)
            .where(eq(s.navigationPresets.id, id))
            .returning()
        : await tx.insert(s.navigationPresets).values(values).returning();
      if (!row) throw new AppError("NOT_FOUND", "Navigation not found");
      await tx
        .delete(s.navigationPresetTags)
        .where(eq(s.navigationPresetTags.presetId, row.id));
      if (tagIds.length)
        await tx
          .insert(s.navigationPresetTags)
          .values(
            [...new Set(tagIds)].map((tagId) => ({ presetId: row.id, tagId })),
          );
      return row;
    });
  }
  if (kind === "categories") {
    const data = parseBody(raw, taxonomySchemas.categories);
    const [row] = id
      ? await db
          .update(s.categories)
          .set(data)
          .where(eq(s.categories.id, id))
          .returning()
      : await db.insert(s.categories).values(data).returning();
    if (!row) throw new AppError("NOT_FOUND", "Category not found");
    return row;
  }
  const data = parseBody(raw, taxonomySchemas.groups);
  const [row] = id
    ? await db
        .update(s.tagGroups)
        .set(data)
        .where(eq(s.tagGroups.id, id))
        .returning()
    : await db.insert(s.tagGroups).values(data).returning();
  if (!row) throw new AppError("NOT_FOUND", "Group not found");
  return row;
}
export async function deleteTaxonomy(kind: TaxonomyKind, id: number) {
  const table = tables[kind];
  const rows = await db
    .delete(table)
    .where(eq(table.id, id))
    .returning({ id: table.id });
  if (!rows.length) throw new AppError("NOT_FOUND", "Taxonomy not found");
}
