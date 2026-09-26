import Link from "next/link";
import { Filters } from "@/components/directory/Filters";
import { CatalogSearchService, getTaxonomy } from "@/server/catalog/service";
import { ListingResults } from "@/components/directory/ListingCard";
import { searchFromParams } from "@/lib/directory";
import { searchSchema } from "@/schemas/directory";
export const dynamic = "force-dynamic";
export const metadata = { title: "搜尋目錄" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v)
      for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
  const taxonomy = await getTaxonomy();
  const raw = searchFromParams(params);
  let unknown = false;
  if (params.has("category")) {
    raw.categoryId = taxonomy.categories.find(
      (c) => c.slug === params.get("category"),
    )?.id;
    unknown ||= !raw.categoryId;
  }
  if (params.has("area")) {
    raw.areaId = taxonomy.areas.find((a) => a.slug === params.get("area"))?.id;
    unknown ||= !raw.areaId;
  }
  if (params.has("tags")) {
    const slugs = params.getAll("tags").flatMap((s) => s.split(","));
    raw.tagIds = slugs.map(
      (slug) => taxonomy.tags.find((t) => t.slug === slug)?.id ?? 0,
    );
    unknown ||= raw.tagIds.includes(0);
  }
  if (params.has("preset")) {
    const preset = taxonomy.navigation.find(
      (p) => p.id === Number(params.get("preset")),
    );
    if (preset)
      Object.assign(raw, {
        categoryId: preset.categoryId ?? undefined,
        areaId: preset.areaId ?? undefined,
        tagIds: preset.tagIds,
        tagMatchMode: preset.matchMode,
        priceMin: preset.priceMin === null ? null : Number(preset.priceMin),
        priceMax: preset.priceMax === null ? null : Number(preset.priceMax),
      });
    else unknown = true;
  }
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success || unknown)
    return (
      <div className="container page-heading">
        <h1>搜尋條件無效</h1>
        <p>請檢查價格、分類及標籤，然後重新搜尋。</p>
        <Link href="/search" className="button">
          重設搜尋
        </Link>
      </div>
    );
  const input = parsed.data;
  const result = await CatalogSearchService.search(input);
  const pageUrl = (page: number) => {
    const copy = new URLSearchParams(params);
    copy.set("page", String(page));
    return `/search?${copy}`;
  };
  return (
    <div className="container">
      <div className="page-heading">
        <h1>探索香港生活目錄</h1>
      </div>
      <form action="/search">
        <div className="search-bar">
          <input
            name="q"
            defaultValue={input.query}
            aria-label="搜尋關鍵字"
            placeholder="店名、服務或關鍵字"
          />
          <button className="button primary">搜尋</button>
        </div>
        <div className="search-layout">
          <Filters>
            <div className="filter-fields">
              <label>
                分類
                <select name="categoryId" defaultValue={input.categoryId ?? ""}>
                  <option value="">全部分類</option>
                  {taxonomy.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                地區
                <select name="areaId" defaultValue={input.areaId ?? ""}>
                  <option value="">所有地區 / 網上資源</option>
                  {taxonomy.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.parentId ? "↳ " : ""}
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>標籤（同時符合）</legend>
                {taxonomy.tags
                  .filter((t) => t.filterable)
                  .map((t) => (
                    <label className="check" key={t.id}>
                      <input
                        type="checkbox"
                        name="tagIds"
                        value={t.id}
                        defaultChecked={input.tagIds.includes(t.id)}
                      />
                      {t.name}
                    </label>
                  ))}
              </fieldset>
              <label>
                最低預算（HK$）
                <input
                  type="number"
                  name="priceMin"
                  min="0"
                  step="0.01"
                  defaultValue={input.priceMin ?? ""}
                />
              </label>
              <label>
                最高預算（HK$）
                <input
                  type="number"
                  name="priceMax"
                  min="0"
                  step="0.01"
                  defaultValue={input.priceMax ?? ""}
                />
              </label>
              <label>
                排序
                <select name="sort" defaultValue={input.sort}>
                  <option value="manual">推薦排序</option>
                  <option value="relevance">相關程度</option>
                  <option value="newest">最新收錄</option>
                  <option value="price-asc">價格由低至高</option>
                  <option value="price-desc">價格由高至低</option>
                </select>
              </label>
              <button className="button primary">套用篩選</button>
              <Link href="/search" className="text-link">
                清除全部
              </Link>
            </div>
          </Filters>
          <section className="results">
            <div className="results-count">
              <span>{result.total} 個結果</span>
              <span className="muted">
                {input.query && `「${input.query}」`}
              </span>
            </div>
            <ListingResults items={result.items} />
            <nav className="pagination" aria-label="搜尋分頁">
              {input.page > 1 && (
                <Link className="button" href={pageUrl(input.page - 1)}>
                  上一頁
                </Link>
              )}
              <span>
                {input.page} / {Math.max(1, result.totalPages)}
              </span>
              {input.page < result.totalPages && (
                <Link className="button" href={pageUrl(input.page + 1)}>
                  下一頁
                </Link>
              )}
            </nav>
          </section>
        </div>
      </form>
    </div>
  );
}
