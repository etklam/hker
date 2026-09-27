import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { CatalogSearchService } from "@/server/catalog/service";
import { formatPrice } from "@/lib/directory";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await CatalogSearchService.detail(slug);
  if (!listing) return { title: "找不到收錄", robots: { index: false } };
  return {
    title: listing.name,
    description: listing.shortDescription,
    alternates: { canonical: `/listing/${listing.slug}` },
    openGraph: {
      title: listing.name,
      description: listing.shortDescription,
      url: `/listing/${listing.slug}`,
      type: "website",
    },
  };
}
export default async function ListingDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await CatalogSearchService.detail(slug);
  if (!listing) notFound();
  if (listing.slug !== slug) permanentRedirect(`/listing/${listing.slug}`);
  return (
    <div className="container">
      <article className="detail">
        <Link href="/search" className="text-link">
          ← 返回目錄
        </Link>
        <header className="detail-header">
          <div className="listing-meta">
            {[listing.area?.name, listing.category?.name]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h1>{listing.name}</h1>
          <p className="muted">{listing.shortDescription}</p>
          <div className="price">{formatPrice(listing)}</div>
          <div className="tag-list">
            {listing.tags.map((t) => (
              <span key={t.id}>
                {t.filterable ? (
                  <Link
                    href={`/search?tags=${t.slug}`}
                    data-catalog-kind="tag"
                    data-catalog-key={t.id}
                  >
                    #{t.name}
                  </Link>
                ) : (
                  `#${t.name}`
                )}
              </span>
            ))}
          </div>
        </header>
        <div className="detail-body">{listing.description}</div>
        <div className="detail-links">
          {listing.links.map((l) => (
            <a
              key={l.id}
              className="button"
              href={`/out/${l.id}?source=web`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
        {Object.keys(listing.attrs).length > 0 && (
          <dl className="attributes">
            {Object.entries(listing.attrs).map(([key, value]) => (
              <div key={key}>
                <dt className="muted">{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </article>
    </div>
  );
}
