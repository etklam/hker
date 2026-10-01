import Link from "next/link";
import { getTaxonomy } from "@/server/catalog/service";
export const dynamic = "force-dynamic";
export const metadata = { title: "標籤" };
export default async function Tags() {
  const { tags, groups } = await getTaxonomy();
  const filterable = tags.filter((t) => t.filterable);
  const sections = [...groups, { id: null, name: "所有其他標籤" }]
    .map((g) => ({
      ...g,
      items: filterable.filter((t) =>
        g.id === null
          ? !groups.some((group) => group.id === t.groupId)
          : t.groupId === g.id,
      ),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <div className="container">
      <div className="page-heading">
        <h1>由興趣開始探索</h1>
        <p>選擇標籤，發掘適合你的收錄。</p>
      </div>
      {sections.length ? (
        sections.map((g) => (
          <section className="tag-group" key={g.id ?? "other"}>
            <h2>{g.name}</h2>
            <div className="chips">
              {g.items.map((t) => (
                <Link
                  className="chip"
                  key={t.id}
                  href={`/search?tags=${t.slug}`}
                  data-catalog-kind="tag"
                  data-catalog-key={t.id}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty">
          <h3>標籤整理中</h3>
          <p className="muted">管理員仍在編排標籤。你可以先用關鍵字搜尋整個目錄。</p>
          <Link href="/search" className="button">瀏覽全部收錄</Link>
        </div>
      )}
    </div>
  );
}
