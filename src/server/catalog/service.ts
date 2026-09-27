import { recordContentChange, type MutationContext } from "./history";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db, type DB } from "@/server/db";
import * as s from "@/db/schema/directory";
import {
  listingSchema,
  searchSchema,
  taxonomySchemas,
  type SearchInput,
  type TaxonomyKind,
} from "@/schemas/directory";
import { parseBody } from "@/schemas/parse-body";
import { orderAreaHierarchy } from "@/lib/directory";
import { resolveNavigationPreset } from "@/lib/directory-presets";
import { AppError } from "@/lib/errors";

export type CatalogExecutor = Pick<DB, "select" | "insert" | "update" | "delete" | "execute" | "transaction">;
export async function configureCatalogTransaction(executor: CatalogExecutor) {
  await executor.execute(sql`set local lock_timeout = '2s'`);
  await executor.execute(sql`set local statement_timeout = '10s'`);
}
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
export async function getTaxonomy(audience: Audience = "public", executor: CatalogExecutor = db) {
  const [categories, areas, tags, groups, navigation, aliases, presetTags] =
    await Promise.all([
      executor
        .select()
        .from(s.categories)
        .where(
          audience === "admin" ? undefined : eq(s.categories.enabled, true),
        )
        .orderBy(asc(s.categories.sortOrder), asc(s.categories.id)),
      executor
        .select()
        .from(s.areas)
        .where(audience === "admin" ? undefined : eq(s.areas.enabled, true))
        .orderBy(asc(s.areas.sortOrder), asc(s.areas.id)),
      executor
        .select()
        .from(s.tags)
        .where(tagVisibility(audience))
        .orderBy(asc(s.tags.sortOrder), asc(s.tags.id)),
      executor
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
        .orderBy(asc(s.tagGroups.sortOrder), asc(s.tagGroups.id)),
      executor
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
        .orderBy(asc(s.navigationPresets.sortOrder), asc(s.navigationPresets.id)),
      audience === "admin"
        ? executor.select().from(s.tagAliases)
        : Promise.resolve([]),
      executor.select().from(s.navigationPresetTags),
    ]);
  return {
    categories,
    areas: orderAreaHierarchy(areas),
    tags: tags.map((t) => ({
      ...t,
      aliases: aliases.filter((a) => a.tagId === t.id).map((a) => a.alias),
    })),
    groups,
    navigation: navigation.map(preset => {
      const tagIds = presetTags.filter(relation => relation.presetId === preset.id).map(relation => relation.tagId);
      const resolution = resolveNavigationPreset({ ...preset, tagIds }, { categories, areas, tags }, audience);
      return {
        ...preset,
        tagIds,
        available: resolution.available,
        warning: resolution.available ? null : resolution.reason,
      };
    }).filter(preset => audience === "admin" || preset.available),
  };
}
export type Taxonomy = Awaited<ReturnType<typeof getTaxonomy>>;
const normalized = (value: SQL) => sql`lower(regexp_replace(trim(normalize(${value}, NFKC)), '\\s+', ' ', 'g'))`;
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
      or ${normalized(sql`${s.listings.name}`)} like ${pattern} or ${normalized(sql`${s.listings.shortDescription}`)} like ${pattern} or ${normalized(sql`${s.listings.description}`)} like ${pattern}
      or exists (select 1 from jsonb_array_elements_text(${s.listings.aliases}) a where ${normalized(sql`a`)} like ${pattern})
      or exists (select 1 from jsonb_each_text(${s.listings.attrs}) a where ${normalized(sql`a.key || ' ' || a.value`)} like ${pattern})
      or exists (select 1 from ${s.areas} where ${s.areas.id} = ${s.listings.areaId} and ${s.areas.enabled} and ${normalized(sql`${s.areas.name}`)} like ${pattern})
      or exists (select 1 from ${s.categories} where ${s.categories.id} = ${s.listings.categoryId} and ${s.categories.enabled} and ${normalized(sql`${s.categories.name}`)} like ${pattern})
      or exists (select 1 from ${s.listingTags} join ${s.tags} on ${s.tags.id} = ${s.listingTags.tagId} where ${s.listingTags.listingId} = ${s.listings.id} and ${tagVisibility(audience)} and (${normalized(sql`${s.tags.name}`)} like ${pattern} or exists (select 1 from ${s.tagAliases} where ${s.tagAliases.tagId} = ${s.tags.id} and ${normalized(sql`${s.tagAliases.alias}`)} like ${pattern})))
    )`);
  }
  return and(...conditions)!;
}
async function hydrate(
  rows: (typeof s.listings.$inferSelect)[],
  audience: Audience,
  executor: CatalogExecutor,
) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const categoryIds = rows.flatMap(r => r.categoryId ? [r.categoryId] : []);
  const areaIds = rows.flatMap(r => r.areaId ? [r.areaId] : []);
  const [categories, areas, links, relations] = await Promise.all([
    categoryIds.length ? executor.select().from(s.categories).where(and(inArray(s.categories.id, categoryIds), audience === "admin" ? undefined : eq(s.categories.enabled, true))) : [],
    areaIds.length ? executor.select().from(s.areas).where(and(inArray(s.areas.id, areaIds), audience === "admin" ? undefined : eq(s.areas.enabled, true))) : [],
    executor.select().from(s.listingLinks).where(and(inArray(s.listingLinks.listingId, ids), audience === "admin" ? undefined : eq(s.listingLinks.enabled, true))).orderBy(asc(s.listingLinks.sortOrder), asc(s.listingLinks.id)),
    executor.select({ listingId: s.listingTags.listingId, tag: s.tags }).from(s.listingTags).innerJoin(s.tags, eq(s.tags.id, s.listingTags.tagId)).where(and(inArray(s.listingTags.listingId, ids), tagVisibility(audience))).orderBy(asc(s.tags.sortOrder), asc(s.tags.id)),
  ]);
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const areaMap = new Map(areas.map(a => [a.id, a]));
  const linkMap = new Map<number, typeof links>();
  const tagMap = new Map<number, (typeof s.tags.$inferSelect & { aliases: string[] })[]>();
  for (const link of links) linkMap.set(link.listingId, [...(linkMap.get(link.listingId) ?? []), link]);
  for (const relation of relations) tagMap.set(relation.listingId, [...(tagMap.get(relation.listingId) ?? []), { ...relation.tag, aliases: [] }]);
  return rows.map(row => ({ ...row, category: categoryMap.get(row.categoryId!) ?? null, area: areaMap.get(row.areaId!) ?? null, links: linkMap.get(row.id) ?? [], tags: tagMap.get(row.id) ?? [] }));
}
export type CatalogListing = Awaited<ReturnType<typeof hydrate>>[number];
export const CatalogSearchService = {
  async search(raw: SearchInput = {}, audience: Audience = "public", executor: CatalogExecutor = db) {
    const input = parseBody(raw, searchSchema);
    if (audience !== "admin" && (input.status !== "all" || input.sort === "updated")) throw new AppError("INVALID_REQUEST", "公開搜尋不支援管理員狀態篩選。");
    if (audience !== "admin") {
      const [categories, areas, tags] = await Promise.all([
        input.categoryId ? executor.select({ id: s.categories.id }).from(s.categories).where(and(eq(s.categories.id, input.categoryId), eq(s.categories.enabled, true))) : [],
        input.areaId ? executor.select({ id: s.areas.id }).from(s.areas).where(and(eq(s.areas.id, input.areaId), eq(s.areas.enabled, true))) : [],
        input.tagIds.length ? executor.select({ id: s.tags.id }).from(s.tags).where(and(inArray(s.tags.id, input.tagIds), tagVisibility(audience), eq(s.tags.filterable, true))) : [],
      ]);
      if ((input.categoryId && !categories.length) || (input.areaId && !areas.length) || tags.length !== input.tagIds.length) throw new AppError("INVALID_REQUEST", "所選篩選條件已停用或不存在，請重新選擇。");
    }
    const where = and(buildSearchWhere(input, audience), input.sort.startsWith("price-") ? eq(s.listings.priceCurrency, "HKD") : undefined)!;
    const exact = sql`case when ${normalized(sql`${s.listings.name}`)} = ${input.query} then 400 when exists (select 1 from jsonb_array_elements_text(${s.listings.aliases}) a where ${normalized(sql`a`)} = ${input.query}) then 300 when exists (select 1 from ${s.listingTags} join ${s.tags} on ${s.tags.id}=${s.listingTags.tagId} where ${s.listingTags.listingId}=${s.listings.id} and ${tagVisibility(audience)} and (${normalized(sql`${s.tags.name}`)}=${input.query} or exists(select 1 from ${s.tagAliases} where ${s.tagAliases.tagId}=${s.tags.id} and ${normalized(sql`${s.tagAliases.alias}`)}=${input.query}))) then 200 when ${normalized(sql`${s.listings.name}`)} like ${`${escapeLike(input.query)}%`} then 150 when ${normalized(sql`${s.listings.name}`)} like ${`%${escapeLike(input.query)}%`} then 100
      when exists (select 1 from jsonb_array_elements_text(${s.listings.aliases}) a where ${normalized(sql`a`)} like ${`%${escapeLike(input.query)}%`}) then 80
      when exists (select 1 from ${s.listingTags} join ${s.tags} on ${s.tags.id}=${s.listingTags.tagId} where ${s.listingTags.listingId}=${s.listings.id} and ${tagVisibility(audience)} and (${normalized(sql`${s.tags.name}`)} like ${`%${escapeLike(input.query)}%`} or exists (select 1 from ${s.tagAliases} where ${s.tagAliases.tagId}=${s.tags.id} and ${normalized(sql`${s.tagAliases.alias}`)} like ${`%${escapeLike(input.query)}%`}))) then 60
      else 0 end`;
    const rank = sql`ts_rank(to_tsvector('simple', ${s.listings.name} || ' ' || ${s.listings.description}), plainto_tsquery('simple', ${input.query}))`;
    const order =
      input.sort === "updated" ? [desc(s.listings.updatedAt)] : input.sort === "newest"
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
              ? [desc(exact), desc(rank), asc(s.listings.sortOrder)]
              : [asc(s.listings.sortOrder)];
    const [rows, [count]] = await Promise.all([
      executor
        .select()
        .from(s.listings)
        .where(where)
        .orderBy(...order, asc(s.listings.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      executor
        .select({ total: sql<number>`count(*)::int` })
        .from(s.listings)
        .where(where),
    ]);
    return {
      items: await hydrate(rows, audience, executor),
      total: count.total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(count.total / input.pageSize),
    };
  },
  async detail(slug: string, audience: Audience = "public", executor: CatalogExecutor = db) {
    const rows = await executor
      .select()
      .from(s.listings)
      .where(
        and(
          sql`(${s.listings.slug} = ${slug} or ${s.listings.id} in (select ${s.listingSlugAliases.listingId} from ${s.listingSlugAliases} where ${s.listingSlugAliases.slug} = ${slug}))`,
          audience === "admin" ? undefined : publicVisibility(),
        ),
      )
      .limit(1);
    return (await hydrate(rows, audience, executor))[0] ?? null;
  },
};
export async function saveListingInTransaction(tx: CatalogExecutor, raw: unknown, id?: number, context: MutationContext = {}) {
  const { links, tagIds, revision, ...data } = parseBody(raw, listingSchema);
  const replaceLinks = typeof raw === "object" && raw !== null && Object.hasOwn(raw, "links");
    await configureCatalogTransaction(tx);
    // ponytail: serialize listing writes to protect the shared slug namespace; use ordered per-slug locks if write throughput requires it.
    await tx.execute(sql`select pg_advisory_xact_lock(724111)`);
    const [old] = id ? await tx.select().from(s.listings).where(eq(s.listings.id, id)).for("update") : [];
    if (id && !old) throw new AppError("NOT_FOUND", "Listing not found");
    if (old && revision !== old.revision) throw new AppError("CONFLICT", "此項目已被其他編輯更新，請保留草稿並重新載入。");
    const [reserved] = await tx.select().from(s.listingSlugAliases).where(eq(s.listingSlugAliases.slug, data.slug));
    const [canonical] = await tx.select().from(s.listings).where(eq(s.listings.slug, data.slug));
    if ((reserved && reserved.listingId !== id) || (canonical && canonical.id !== id)) throw new AppError("CONFLICT", "此網址代稱已被使用或保留。");
    const existing = id ? await tx.select().from(s.listingLinks).where(eq(s.listingLinks.listingId, id)) : [];
    const submittedIds = links.flatMap(l => l.id ? [l.id] : []);
    if (new Set(submittedIds).size !== submittedIds.length || submittedIds.some(childId => !existing.some(l => l.id === childId))) throw new AppError("INVALID_REQUEST", "外部連結不屬於此項目或重複提交。");
    const oldTags = old ? await tx.select().from(s.listingTags).where(eq(s.listingTags.listingId, old.id)) : [];
    const values = { ...data, aliases: [...new Set(data.aliases)], priceMin: data.priceMin?.toFixed(2) ?? null, priceMax: data.priceMax?.toFixed(2) ?? null, updatedAt: new Date() };
    const [row] = old
      ? await tx.update(s.listings).set({ ...values, revision: old.revision + 1 }).where(and(eq(s.listings.id, old.id), eq(s.listings.revision, revision!))).returning()
      : await tx.insert(s.listings).values(values).returning();
    if (!row) throw new AppError("CONFLICT", "此項目已被其他編輯更新。");
    if (old && old.slug !== row.slug) await tx.insert(s.listingSlugAliases).values({ slug: old.slug, listingId: row.id }).onConflictDoNothing();
    for (const link of existing) if (replaceLinks && !submittedIds.includes(link.id)) await tx.delete(s.listingLinks).where(eq(s.listingLinks.id, link.id));
    for (const { id: linkId, ...link } of links) {
      if (linkId) await tx.update(s.listingLinks).set({ ...link, updatedAt: new Date() }).where(and(eq(s.listingLinks.id, linkId), eq(s.listingLinks.listingId, row.id)));
      else await tx.insert(s.listingLinks).values({ ...link, listingId: row.id });
    }
    await tx.delete(s.listingTags).where(eq(s.listingTags.listingId, row.id));
    if (tagIds.length) await tx.insert(s.listingTags).values([...new Set(tagIds)].map(tagId => ({ listingId: row.id, tagId })));
    const finalLinks = (await tx.select().from(s.listingLinks).where(eq(s.listingLinks.listingId, row.id)).orderBy(asc(s.listingLinks.sortOrder), asc(s.listingLinks.id))).map(({ id, type, label, url, sortOrder, enabled }) => ({ id, type, label, url, sortOrder, enabled }));
    await recordContentChange(tx, "listing", row.id, old ? { ...old, links: existing.map(({ id, type, label, url, sortOrder, enabled }) => ({ id, type, label, url, sortOrder, enabled })), tagIds: oldTags.map(t => t.tagId).sort((a,b) => a-b) } : {}, { ...row, links: finalLinks, tagIds: [...new Set(tagIds)].sort((a,b) => a-b) }, context);
    return row;
}
export async function saveListing(raw: unknown, id?: number, context: MutationContext = {}) {
  return db.transaction(tx => saveListingInTransaction(tx, raw, id, context));
}
export async function deleteListing(id: number) {
  const rows = await db
    .delete(s.listings)
    .where(eq(s.listings.id, id))
    .returning({ id: s.listings.id });
  if (!rows.length) throw new AppError("NOT_FOUND", "Listing not found");
}
export async function validateNavigationPresetForSave(
  tx: CatalogExecutor,
  data: Parameters<typeof resolveNavigationPreset>[0],
  allowBroad = false,
) {
  const { tagIds } = data;
      const selectedCategories = data.categoryId ? await tx.select().from(s.categories).where(eq(s.categories.id, data.categoryId)).for("share") : [];
      const selectedAreas = data.areaId ? await tx.select().from(s.areas).where(eq(s.areas.id, data.areaId)).for("share") : [];
      const selectedTags = tagIds.length ? await tx.select().from(s.tags).where(inArray(s.tags.id, tagIds)).orderBy(asc(s.tags.id)).for("share") : [];
      if ((data.categoryId && !selectedCategories.length) || (data.areaId && !selectedAreas.length) || selectedTags.length !== new Set(tagIds).size) {
        throw new AppError("INVALID_REQUEST", "導覽參照不存在，請重新選擇。");
      }
      if (data.enabled) {
        if (!data.categoryId && !data.areaId && !tagIds.length && data.priceMin === null && data.priceMax === null && !allowBroad) {
          throw new AppError("INVALID_REQUEST", "請明確確認此導覽為全部收錄，或選擇篩選條件。");
        }
        const resolution = resolveNavigationPreset({ ...data, tagIds }, { categories: selectedCategories, areas: selectedAreas, tags: selectedTags }, "admin");
        if (!resolution.available) throw new AppError("CONFLICT", resolution.reason);
      }
}

async function writeTaxonomy(
  kind: TaxonomyKind,
  raw: unknown,
  id: number | undefined,
  database: CatalogExecutor,
) {
  if (kind === "areas") {
    const data = parseBody(raw, taxonomySchemas.areas);
    // Serialize hierarchy edits to prevent concurrent cycle creation.
    return database.transaction(async (tx) => {
      await configureCatalogTransaction(tx);
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
    return database.transaction(async (tx) => {
      await configureCatalogTransaction(tx);
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
    const { tagIds, allowBroad, ...data } = parseBody(raw, taxonomySchemas.navigation);
    const values = {
      ...data,
      priceMin: data.priceMin?.toFixed(2) ?? null,
      priceMax: data.priceMax?.toFixed(2) ?? null,
    };
    return database.transaction(async (tx) => {
      await configureCatalogTransaction(tx);
      await validateNavigationPresetForSave(tx, { ...data, tagIds }, allowBroad);
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
      ? await database
          .update(s.categories)
          .set(data)
          .where(eq(s.categories.id, id))
          .returning()
      : await database.insert(s.categories).values(data).returning();
    if (!row) throw new AppError("NOT_FOUND", "Category not found");
    return row;
  }
  const data = parseBody(raw, taxonomySchemas.groups);
  const [row] = id
    ? await database
        .update(s.tagGroups)
        .set(data)
        .where(eq(s.tagGroups.id, id))
        .returning()
    : await database.insert(s.tagGroups).values(data).returning();
  if (!row) throw new AppError("NOT_FOUND", "Group not found");
  return row;
}
export async function saveTaxonomy(kind: TaxonomyKind, raw: unknown, id?: number, context: MutationContext = {}, database: CatalogExecutor = db) {
  return database.transaction(async tx => {
    await configureCatalogTransaction(tx);
    const table = tables[kind];
    const [before] = id ? await tx.select().from(table).where(eq(table.id, id)).for("update") : [];
    const previous = before ? { ...before } as Record<string, unknown> : {};
    if (id && kind === "tags") previous.aliases = (await tx.select().from(s.tagAliases).where(eq(s.tagAliases.tagId, id))).map(row => row.alias);
    if (id && kind === "navigation") previous.tagIds = (await tx.select().from(s.navigationPresetTags).where(eq(s.navigationPresetTags.presetId, id))).map(row => row.tagId);
    const row = await writeTaxonomy(kind, raw, id, tx);
    const validated = taxonomySchemas[kind].parse(raw);
    await recordContentChange(tx, kind, row.id, previous, { ...row, ...validated }, context);
    return row;
  });
}
async function removeTaxonomy(kind: TaxonomyKind, id: number, executor: CatalogExecutor) {
  const table = tables[kind];
  const rows = await executor
    .delete(table)
    .where(eq(table.id, id))
    .returning({ id: table.id });
  if (!rows.length) throw new AppError("NOT_FOUND", "Taxonomy not found");
}

export async function getTaxonomyImpact(kind: TaxonomyKind, id: number, executor: CatalogExecutor = db) {
  const count = async (query: SQL) => Number((await executor.execute(query))[0]?.count ?? 0);
  const [listings, presets, children, tags] = await Promise.all([
    kind === "categories" ? count(sql`select count(*)::int from ${s.listings} where ${s.listings.categoryId}=${id}`) : kind === "areas" ? count(sql`select count(*)::int from ${s.listings} where ${s.listings.areaId}=${id}`) : kind === "tags" ? count(sql`select count(*)::int from ${s.listingTags} where ${s.listingTags.tagId}=${id}`) : 0,
    kind === "categories" ? count(sql`select count(*)::int from ${s.navigationPresets} where ${s.navigationPresets.categoryId}=${id}`) : kind === "areas" ? count(sql`select count(*)::int from ${s.navigationPresets} where ${s.navigationPresets.areaId}=${id}`) : kind === "tags" ? count(sql`select count(*)::int from ${s.navigationPresetTags} where ${s.navigationPresetTags.tagId}=${id}`) : 0,
    kind === "areas" ? count(sql`select count(*)::int from ${s.areas} where ${s.areas.parentId}=${id}`) : 0,
    kind === "groups" ? count(sql`select count(*)::int from ${s.tags} where ${s.tags.groupId}=${id}`) : 0,
  ]);
  return { listings, presets, children, tags };
}
export async function deleteTaxonomy(kind: TaxonomyKind, id: number) {
  return db.transaction(async tx => {
    await configureCatalogTransaction(tx);
    const table = tables[kind];
    const rows = await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).for("update");
    if (!rows.length) throw new AppError("NOT_FOUND", "Taxonomy not found");
    const impact = await getTaxonomyImpact(kind, id, tx);
    if (Object.values(impact).some(Boolean)) {
      const error = new AppError("CONFLICT", `仍有相依資料：${impact.listings} 個項目、${impact.presets} 個導覽、${impact.children} 個子地區、${impact.tags} 個標籤。請先停用或重新指派。`);
      Object.assign(error, { impact });
      throw error;
    }
    await removeTaxonomy(kind, id, tx);
  });
}
