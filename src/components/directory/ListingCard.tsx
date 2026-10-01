import Link from "next/link";
import type { CatalogListing } from "@/server/catalog/service";
import { formatPrice } from "@/lib/directory";
export function ListingCard({
  listing,
  returnTo,
  markFeatured = true,
}: {
  listing: CatalogListing;
  returnTo?: string;
  markFeatured?: boolean;
}) {
  const detailHref = `/listing/${listing.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  const where = [listing.area?.name, listing.category?.name]
    .filter(Boolean)
    .join(" · ");
  const price = formatPrice(listing);
  const tags = listing.tags.slice(0, 4);
  return (
    <li className="listing-card">
      <h3>
        {markFeatured && listing.featured && (
          <>
            <span className="vh">精選 · </span>
            <span className="seal-mark" aria-hidden="true" />
          </>
        )}
        <Link href={detailHref}>{listing.name}</Link>
      </h3>
      {price && <div className="price">{price}</div>}
      {where && <div className="listing-meta">{where}</div>}
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
                  #{tag.name}
                </Link>
              ) : (
                `#${tag.name}`
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
}: {
  items: CatalogListing[];
  returnTo?: string;
  markFeatured?: boolean;
}) {
  return items.length ? (
    <ul className="listing-grid">
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
      <p className="muted">試試其他關鍵字，或減少篩選條件。再唔係，由分類或標籤入手通常更快。</p>
      <Link href="/search" className="button">
        瀏覽全部收錄
      </Link>
    </div>
  );
}
