import Link from "next/link";
import type { PublicCatalogListing } from "@/server/catalog/public-dto";
import { formatPrice } from "@/lib/directory";
import { areaPlate, latinName } from "@/lib/plate";

export function ListingCard({
  listing,
  returnTo,
  markFeatured = true,
}: {
  listing: PublicCatalogListing;
  returnTo?: string;
  markFeatured?: boolean;
}) {
  const detailHref = `/listing/${listing.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  const plate = areaPlate(listing.area);
  const latin = latinName(listing.attrs);
  const price = formatPrice(listing);
  const tags = listing.tags.slice(0, 4);
  const featured = markFeatured && listing.featured;
  return (
    <li className="listing-card">
      {/* Readable, not decorative: the plate is where the area now lives. */}
      <span
        className="plate"
        data-fit={plate.fit}
        data-online={plate.online || undefined}
        data-featured={featured || undefined}
      >
        {plate.label}
      </span>
      <h3>
        {featured && <span className="vh">精選 · </span>}
        <Link href={detailHref}>{listing.name}</Link>
        {latin && <span className="latin">{latin}</span>}
      </h3>
      {price && <div className="price">{price}</div>}
      {listing.category && (
        <div className="listing-meta">{listing.category.name}</div>
      )}
      <p className="description">{listing.shortDescription}</p>
      {tags.length > 0 && (
        <ul className="tag-list">
          {tags.map((tag) => (
            <li key={tag.id}>
              {tag.filterable ? (
                <Link
                  href={`/search?tags=${tag.slug}`}
                  data-catalog-kind="tag"
                  data-catalog-key={tag.id}
                >
                  {tag.name}
                </Link>
              ) : (
                tag.name
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
export function ListingResults({
  items,
  returnTo,
  markFeatured,
  columns,
}: {
  items: PublicCatalogListing[];
  returnTo?: string;
  markFeatured?: boolean;
  /** Two-column boards are for browsing; results stay a single scan column. */
  columns?: 1 | 2;
}) {
  return items.length ? (
    <ul className="listing-grid" data-columns={columns ?? 1}>
      {items.map((item) => (
        <ListingCard
          key={item.id}
          listing={item}
          returnTo={returnTo}
          markFeatured={markFeatured}
        />
      ))}
    </ul>
  ) : (
    <div className="empty">
      <h3>暫時未有符合的收錄</h3>
      <p className="muted">
        試試其他關鍵字，或減少篩選條件。再唔係，由分類或標籤入手通常更快。
      </p>
      <Link href="/search" className="button">
        瀏覽全部收錄
      </Link>
    </div>
  );
}
