import Link from "next/link";
import { getTaxonomy } from "@/server/catalog/service";
export const dynamic = "force-dynamic";
export const metadata = { title: "標籤" };
export default async function Tags() {
  const { tags, groups } = await getTaxonomy();
  return (
    <div className="container">
      <div className="page-heading">
        <h1>由興趣開始探索</h1>
        <p className="muted">選擇標籤，發掘適合你的收錄。</p>
      </div>
      {[...groups, { id: null, name: "所有其他標籤" }].map((g) => (
        <section key={g.id ?? "other"}>
          <h2>{g.name}</h2>
          <div className="chips">
            {tags
              .filter(
                (t) =>
                  t.filterable &&
                  (g.id === null
                    ? !groups.some((group) => group.id === t.groupId)
                    : t.groupId === g.id),
              )
              .map((t) => (
                <Link
                  className="chip"
                  key={t.id}
                  href={`/search?tags=${t.slug}`}
                >
                  #{t.name}
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
