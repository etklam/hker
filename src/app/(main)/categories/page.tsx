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
        <p className="muted">找到你需要的地方、服務與資源。</p>
      </div>
      <div className="taxonomy-list">
        {categories.map((c) => (
          <Link key={c.id} href={`/search?category=${c.slug}`}>
            <h3>{c.name}</h3>
            <span className="muted">{c.description}</span>
          </Link>
        ))}
      </div>
      {!categories.length && (
        <p className="empty">分類整理中，稍後再來看看。</p>
      )}
    </div>
  );
}
