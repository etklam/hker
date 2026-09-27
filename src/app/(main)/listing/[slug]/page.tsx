import { ExternalActions } from "@/components/directory/ExternalActions";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { publicListingDetail } from "@/server/catalog/public-detail";
import { searchReturnPath } from "@/lib/search-return";
import { formatPrice } from "@/lib/directory";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await publicListingDetail(slug);
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const returnTo = searchReturnPath((await searchParams).returnTo);
  const { slug } = await params;
  const listing = await publicListingDetail(slug);
  if (!listing) notFound();
  if (listing.slug !== slug) permanentRedirect(`/listing/${listing.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
  return (
    <div className="container">
      <article className="detail">
        <Link href={returnTo ?? "/search"} className="text-link">
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
        <ExternalActions links={listing.links} />
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
