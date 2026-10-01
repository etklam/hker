import Link from "next/link";
import { getTaxonomy } from "@/server/catalog/service";
export const dynamic = "force-dynamic";
export const metadata = { title: "分類" };
export default async function Categories() {
  const { categories } = await getTaxonomy();
  return (
    <div className="container">
      <div className="page-heading">
        <h1>按分類探索</h1>
        <p>找到你需要的地方、服務與資源。</p>
      </div>
      {categories.length ? (
        <div className="taxonomy-list">
          {categories.map((c) => (
            <Link key={c.id} href={`/search?category=${c.slug}`}>
              <h3>{c.name}</h3>
              {c.description && <span className="muted">{c.description}</span>}
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>分類整理中</h3>
          <p className="muted">管理員仍在編排分類。你可以先用關鍵字搜尋整個目錄。</p>
          <Link href="/search" className="button">瀏覽全部收錄</Link>
        </div>
      )}
    </div>
  );
}
