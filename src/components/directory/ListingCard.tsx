import Link from "next/link";
import type { CatalogListing } from "@/server/catalog/service";
import { formatPrice } from "@/lib/directory";
export function ListingCard({ listing }: { listing: CatalogListing }) {
  return (
    <article className="listing-card">
      <h3>
        <Link href={`/listing/${listing.slug}`}>{listing.name}</Link>
      </h3>
      <div className="listing-meta">
        {[listing.area?.name, listing.category?.name]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <p className="description">{listing.shortDescription}</p>
      {formatPrice(listing) && (
        <div className="price">{formatPrice(listing)}</div>
      )}
      <div className="tag-list">
        {listing.tags.slice(0, 3).map((tag) => (
          <span key={tag.id}>
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
          </span>
        ))}
      </div>
      <Link className="text-link" href={`/listing/${listing.slug}`}>
        查看詳情 →
      </Link>
    </article>
  );
}
export function ListingResults({ items }: { items: CatalogListing[] }) {
  return items.length ? (
    <div className="listing-grid">
      {items.map((item) => (
        <ListingCard key={item.id} listing={item} />
      ))}
    </div>
  ) : (
    <div className="empty">
      <h3>暫時未有符合的收錄</h3>
      <p className="muted">試試其他關鍵字，或減少篩選條件。</p>
      <Link href="/search" className="text-link">
        瀏覽全部收錄
      </Link>
    </div>
  );
}
