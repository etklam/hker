import { AppError } from "@/lib/errors";
import { parseNativeCatalog } from "./native-format";
import { getTaxonomy, saveTaxonomy, type CatalogExecutor } from "./service";
import type { MutationContext } from "./history";
import { resolveNavigationPreset } from "@/lib/directory-presets";
export async function taxonomyImportPreview(
  source: string,
  tx: CatalogExecutor,
) {
  const incoming = parseNativeCatalog(source).taxonomy;
  const current = await getTaxonomy("admin", tx);
  // Resolve portable relationships against the definitions that will actually exist.
  const effective = {
    categories: [
      ...current.categories,
      ...incoming.categories.filter(
        (row) => !current.categories.some((item) => item.slug === row.slug),
      ),
    ].map((row, index) => ({ ...row, id: index + 1 })),
    areas: [
      ...current.areas,
      ...incoming.areas.filter(
        (row) => !current.areas.some((item) => item.slug === row.slug),
      ),
    ].map((row, index) => ({ ...row, id: index + 1 })),
    tags: [
      ...current.tags,
      ...incoming.tags.filter(
        (row) => !current.tags.some((item) => item.slug === row.slug),
      ),
    ].map((row, index) => ({ ...row, id: index + 1 })),
  };
  const creates = {
    categories: incoming.categories.filter(
      (row) => !current.categories.some((item) => item.slug === row.slug),
    ),
    groups: incoming.groups.filter(
      (row) => !current.groups.some((item) => item.slug === row.slug),
    ),
    areas: incoming.areas.filter(
      (row) => !current.areas.some((item) => item.slug === row.slug),
    ),
    tags: incoming.tags.filter(
      (row) => !current.tags.some((item) => item.slug === row.slug),
    ),
    navigation: incoming.navigation
      .filter(
        (row) => !current.navigation.some((item) => item.label === row.label),
      )
      .map((row) => {
        const resolution = resolveNavigationPreset(
          {
            ...row,
            categoryId: row.categorySlug
              ? (effective.categories.find(
                  (item) => item.slug === row.categorySlug,
                )?.id ?? -1)
              : null,
            areaId: row.areaSlug
              ? (effective.areas.find((item) => item.slug === row.areaSlug)
                  ?.id ?? -1)
              : null,
            tagIds: row.tagSlugs.map(
              (slug) =>
                effective.tags.find((item) => item.slug === slug)?.id ?? -1,
            ),
          },
          effective,
          "admin",
        );
        return row.enabled && !resolution.available
          ? {
              ...row,
              enabled: false,
              importWarning: `將以停用狀態建立，修正後再手動啟用：${resolution.reason}`,
            }
          : row;
      }),
  };
  for (const kind of ["categories", "groups", "areas", "tags"] as const)
    if (
      new Set(incoming[kind].map((row) => row.slug)).size !==
      incoming[kind].length
    )
      throw new AppError("INVALID_REQUEST", `Duplicate ${kind} slug`);
  return { creates, current };
}
export async function commitTaxonomyImport(
  source: string,
  tx: CatalogExecutor,
  context: MutationContext,
) {
  const { creates, current } = await taxonomyImportPreview(source, tx);
  const maps = {
    categories: new Map(current.categories.map((row) => [row.slug, row.id])),
    groups: new Map(current.groups.map((row) => [row.slug, row.id])),
    areas: new Map(current.areas.map((row) => [row.slug, row.id])),
    tags: new Map(current.tags.map((row) => [row.slug, row.id])),
  };
  let count = 0;
  for (const kind of ["categories", "groups"] as const)
    for (const data of creates[kind]) {
      const row = await saveTaxonomy(kind, data, undefined, context, tx);
      maps[kind].set(data.slug, row.id);
      count++;
    }
  const remaining = [...creates.areas];
  while (remaining.length) {
    const index = remaining.findIndex(
      (row) => row.parentSlug === null || maps.areas.has(row.parentSlug),
    );
    if (index < 0)
      throw new AppError(
        "INVALID_REQUEST",
        "Area parents are missing or cyclic; no taxonomy was created",
      );
    const [data] = remaining.splice(index, 1);
    const row = await saveTaxonomy(
      "areas",
      {
        ...data,
        parentId:
          data.parentSlug === null ? null : maps.areas.get(data.parentSlug),
      },
      undefined,
      context,
      tx,
    );
    maps.areas.set(data.slug, row.id);
    count++;
  }
  for (const data of creates.tags) {
    if (data.groupSlug && !maps.groups.has(data.groupSlug))
      throw new AppError("INVALID_REQUEST", "Missing tag group");
    const row = await saveTaxonomy(
      "tags",
      {
        ...data,
        groupId:
          data.groupSlug === null ? null : maps.groups.get(data.groupSlug),
      },
      undefined,
      context,
      tx,
    );
    maps.tags.set(data.slug, row.id);
    count++;
  }
  for (const data of creates.navigation) {
    if (
      (data.categorySlug && !maps.categories.has(data.categorySlug)) ||
      (data.areaSlug && !maps.areas.has(data.areaSlug)) ||
      data.tagSlugs.some((slug) => !maps.tags.has(slug))
    )
      throw new AppError("INVALID_REQUEST", "Missing navigation relationship");
    await saveTaxonomy(
      "navigation",
      {
        ...data,
        allowBroad: true,
        categoryId:
          data.categorySlug === null
            ? null
            : maps.categories.get(data.categorySlug),
        areaId: data.areaSlug === null ? null : maps.areas.get(data.areaSlug),
        tagIds: data.tagSlugs.map((slug) => maps.tags.get(slug)),
        priceMin: data.priceMin === null ? null : Number(data.priceMin),
        priceMax: data.priceMax === null ? null : Number(data.priceMax),
      },
      undefined,
      context,
      tx,
    );
    count++;
  }
  return count;
}
