import type { CatalogListing } from "./service";

/**
 * What the public surface is allowed to render. A full `CatalogListing` row
 * satisfies it structurally, so pages may pass either an uncached row or a
 * cached DTO without the components knowing the difference.
 */
export type PublicCatalogListing = ReturnType<typeof publicCatalogListing>;

// Public output is an allowlist: schema additions never silently become API fields.
export function publicCatalogListing(row: CatalogListing) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    priceCurrency: row.priceCurrency,
    attrs: row.attrs,
    featured: row.featured,
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          slug: row.category.slug,
        }
      : null,
    area: row.area
      ? { id: row.area.id, name: row.area.name, slug: row.area.slug }
      : null,
    tags: row.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      filterable: tag.filterable,
    })),
    links: row.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      type: link.type,
    })),
  };
}
