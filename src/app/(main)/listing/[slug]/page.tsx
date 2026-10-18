import { ExternalActions } from "@/components/directory/ExternalActions";
import { presentListingLink } from "@/lib/directory-links";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { publicListingDetail } from "@/server/catalog/public-detail";
import { searchReturnPath } from "@/lib/search-return";
import { formatPrice } from "@/lib/directory";
import { areaPlate, isPlateAttr, latinName } from "@/lib/plate";
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
  if (listing.slug !== slug)
    permanentRedirect(
      `/listing/${listing.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
    );
  const visibleLinks = listing.links.filter((link) => presentListingLink(link));
  const plate = areaPlate(listing.area);
  const latin = latinName(listing.attrs);
  const attributes = Object.entries(listing.attrs).filter(
    ([key]) => !isPlateAttr(key),
  );
  return (
    <div className="container">
      <article className="detail">
        <Link href={returnTo ?? "/search"} className="text-link">
          ← 返回目錄
        </Link>
        <header className="detail-header">
          <div className="detail-plate">
            {/* No featured variant here: with nothing to compare against, a
                red plate reads as a claim about the district. */}
            <span
              className="plate"
              data-fit={plate.fit}
              data-online={plate.online || undefined}
            >
              {plate.label}
            </span>
            <div>
              {(listing.featured || listing.category) && (
                <div className="listing-meta">
                  {listing.featured && <b className="featured-mark">精選</b>}
                  {listing.category?.name}
                </div>
              )}
              <h1>{listing.name}</h1>
              {latin && <p className="latin">{latin}</p>}
            </div>
          </div>
          <p className="muted">{listing.shortDescription}</p>
          {formatPrice(listing) && (
            <div className="price">{formatPrice(listing)}</div>
          )}
          {listing.tags.length > 0 && (
            <ul className="tag-list">
              {listing.tags.map((t) => (
                <li key={t.id}>
                  {t.filterable ? (
                    <Link
                      href={`/search?tags=${t.slug}`}
                      data-catalog-kind="tag"
                      data-catalog-key={t.id}
                    >
                      {t.name}
                    </Link>
                  ) : (
                    t.name
                  )}
                </li>
              ))}
            </ul>
          )}
        </header>
        <div className="detail-body">{listing.description}</div>
        {visibleLinks.length > 0 && (
          <section className="detail-section">
            <h2>外部連結</h2>
            <ExternalActions links={visibleLinks} />
          </section>
        )}
        {attributes.length > 0 && (
          <section className="detail-section">
            <h2>詳細資料</h2>
            <dl className="attributes">
              {attributes.map(([key, value]) => (
                <div key={key}>
                  <dt className="muted">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>
    </div>
  );
}
