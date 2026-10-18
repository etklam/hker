import Link from "next/link";
import { cachedHomeSections, cachedTaxonomy } from "@/server/catalog/cache";
import { ListingResults } from "@/components/directory/ListingCard";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [{ featured, newest }, taxonomy] = await Promise.all([
    cachedHomeSections(),
    cachedTaxonomy(),
  ]);
  const result = featured.total ? featured : newest;
  const presets = taxonomy.navigation.filter((p) => p.available);
  return (
    <>
      <section className="board">
        <div className="container">
          <h1>搵到香港值得去、值得用嘅地方同服務</h1>
          <p className="board-latin">Hong Kong Local Directory</p>
          <p className="board-lead">由街坊小店到網上資源，從這裏開始發掘。</p>
          <form action="/search" className="search-bar" role="search">
            <input
              name="q"
              aria-label="搜尋目錄"
              placeholder="搜尋店名、服務或關鍵字"
            />
            <button className="button primary">搜尋</button>
          </form>
          {(presets.length > 0 || taxonomy.categories.length > 0) && (
            <nav className="quicklinks" aria-label="快速瀏覽">
              {presets.map((p) => (
                <Link
                  key={p.id}
                  href={`/search?preset=${p.id}`}
                  data-catalog-kind="preset"
                  data-catalog-key={p.id}
                  data-lead="true"
                >
                  {p.label}
                </Link>
              ))}
              {taxonomy.categories.slice(0, 6).map((c) => (
                <Link href={`/search?category=${c.slug}`} key={c.id}>
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>
      <div className="container">
        <section>
          <div className="section-heading">
            <h2>
              {featured.total ? "精選推薦" : "最新收錄"}
              <span className="latin">
                {featured.total ? "Featured" : "Latest"}
              </span>
            </h2>
            {newest.total > 0 && (
              <Link href="/search" className="text-link">
                <span className="num">{newest.total}</span> 項收錄 · 全部瀏覽
              </Link>
            )}
          </div>
          {result.total ? (
            <ListingResults
              items={result.items}
              markFeatured={!featured.total}
              columns={2}
            />
          ) : (
            <div className="empty">
              <h3>目錄準備中</h3>
              <p className="muted">
                我們正在整理值得推薦的地方與服務，請稍後再來看看。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
