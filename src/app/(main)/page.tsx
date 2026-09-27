import Link from "next/link";
import { CatalogSearchService, getTaxonomy } from "@/server/catalog/service";
import { ListingResults } from "@/components/directory/ListingCard";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [featured, taxonomy] = await Promise.all([
    CatalogSearchService.search({ featured: true, pageSize: 6 }),
    getTaxonomy(),
  ]);
  const result = featured.total ? featured : await CatalogSearchService.search({ sort: "newest", pageSize: 6 });
  return (
    <div className="container">
      <section className="hero">
        <h1>
          搵到香港值得去、
          <br />
          值得用嘅地方同服務。
        </h1>
        <p>由街坊小店到網上資源，從這裏開始發掘。</p>
        <form action="/search" className="search-bar" role="search">
          <input
            name="q"
            aria-label="搜尋目錄"
            placeholder="搜尋店名、服務或關鍵字"
          />
          <button className="button primary">搜尋</button>
        </form>
        <div className="chips">
          {taxonomy.navigation
            .filter((p) => p.available)
            .map((p) => (
              <Link
                className="chip"
                key={p.id}
                href={`/search?preset=${p.id}`}
                data-catalog-kind="preset"
                data-catalog-key={p.id}
              >
                {p.label}
              </Link>
            ))}
          {taxonomy.categories.slice(0, 6).map((c) => (
            <Link
              className="chip"
              href={`/search?category=${c.slug}`}
              key={c.id}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>{featured.total ? "精選推薦" : "最新收錄"}</h2>
          <Link href="/search" className="text-link">
            瀏覽全部 →
          </Link>
        </div>
        {result.total ? <ListingResults items={result.items} /> : (
          <div className="empty"><h3>目錄準備中</h3><p className="muted">我們正在整理值得推薦的地方與服務，請稍後再來看看。</p></div>
        )}
      </section>
    </div>
  );
}
