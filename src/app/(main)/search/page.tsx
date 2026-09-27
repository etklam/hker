import { guardPublicSearch } from "@/server/catalog/abuse";
import { SearchForm } from "@/components/directory/SearchForm";
import { Filters } from "@/components/directory/Filters";
import { CatalogSearchService, getTaxonomy } from "@/server/catalog/service";
import { ListingResults } from "@/components/directory/ListingCard";
import { TagPicker } from "@/components/directory/TagPicker";
import { CatalogSearchObservation } from "@/components/directory/CatalogEvents";
import { issueCatalogSearchObservation } from "@/server/catalog/analytics";
import {
  resolveSearchParams,
  searchToParams,
  orderAreaHierarchy,
} from "@/lib/directory";
import type { SearchState } from "@/schemas/directory";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "搜尋目錄",
  robots: { index: false, follow: true },
};
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await guardPublicSearch();
  } catch {
    return (
      <div className="container page-heading">
        <h1>搜尋過於頻繁</h1>
        <p>請稍候一分鐘再試。</p>
      </div>
    );
  }
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v)
      for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
  const taxonomy = await getTaxonomy();
  let input: SearchState;
  try {
    input = resolveSearchParams(params, taxonomy);
  } catch {
    return (
      <div className="container page-heading">
        <h1>搜尋條件無效</h1>
        <p>請檢查價格、分類及標籤，然後重新搜尋。</p>
        <a href="/search" className="button">
          重設搜尋
        </a>
      </div>
    );
  }
  const result = await CatalogSearchService.search(input);
  const hasStructuredCriteria = Boolean(
    input.categoryId ||
    input.areaId ||
    input.tagIds.length ||
    input.priceMin !== null ||
    input.priceMax !== null ||
    input.featured !== undefined,
  );
  const eventKind = input.query ? "search" : "filter";
  const eventKey = input.query || "applied";
  const observation =
    input.query || hasStructuredCriteria
      ? issueCatalogSearchObservation(eventKind, eventKey, input, result.total)
      : null;
  const formInput = {
    ...input,
    sort: params.get("sort") ? input.sort : undefined,
  };
  const pageUrl = (page: number) => {
    const copy = searchToParams(formInput);
    copy.set("page", String(page));
    return `/search?${copy}`;
  };
  return (
    <div className="container">
      <CatalogSearchObservation
        kind={eventKind}
        eventKey={eventKey}
        search={input}
        observation={observation}
      />
      <div className="page-heading">
        <h1>探索香港生活目錄</h1>
      </div>
      <SearchForm key={searchToParams(formInput).toString()} input={formInput}>
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
                  {orderAreaHierarchy(taxonomy.areas).map((a) => (
                    <option key={a.id} value={a.id}>
                      {"　".repeat(a.depth)}
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <TagPicker
                key={searchToParams(formInput).toString()}
                taxonomy={taxonomy}
                selected={input.tagIds}
              />
              <label>
                標籤配對
                <select name="tagMatchMode" defaultValue={input.tagMatchMode}>
                  <option value="and">符合所有標籤</option>
                  <option value="or">符合任一標籤</option>
                </select>
              </label>
              <label>
                精選收錄
                <select
                  name="featured"
                  defaultValue={
                    input.featured === undefined ? "" : String(input.featured)
                  }
                >
                  <option value="">全部</option>
                  <option value="true">只看精選</option>
                  <option value="false">非精選</option>
                </select>
              </label>
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
              <p className="muted">
                預算與 HKD 價格範圍重疊即符合，僅供參考，並非最終帳單。
              </p>
              <label>
                排序
                <select name="sort" defaultValue={formInput.sort ?? ""}>
                  <option value="">自動（搜尋用相關度，瀏覽用推薦）</option>
                  <option value="manual">推薦排序</option>
                  <option value="relevance">相關程度</option>
                  <option value="newest">最新收錄</option>
                  <option value="price-asc">價格由低至高</option>
                  <option value="price-desc">價格由高至低</option>
                </select>
              </label>
              <button className="button primary">套用篩選</button>
              <a href="/search" className="text-link">
                清除全部
              </a>
            </div>
          </Filters>
          <section className="results">
            <div className="results-count">
              <span>{result.total} 個結果</span>
              <span className="muted">
                {input.query && `「${input.query}」`}
              </span>
            </div>
            <div className="active-filters" aria-label="已套用篩選">
              {[
                ...(input.categoryId
                  ? [
                      {
                        key: "categoryId",
                        label: taxonomy.categories.find(
                          (c) => c.id === input.categoryId,
                        )?.name,
                      },
                    ]
                  : []),
                ...(input.areaId
                  ? [
                      {
                        key: "areaId",
                        label: taxonomy.areas.find((a) => a.id === input.areaId)
                          ?.name,
                      },
                    ]
                  : []),
                ...(input.featured !== undefined
                  ? [
                      {
                        key: "featured",
                        label: input.featured ? "精選" : "非精選",
                      },
                    ]
                  : []),
                ...(input.priceMin !== null
                  ? [{ key: "priceMin", label: `最低 HK$${input.priceMin}` }]
                  : []),
                ...(input.priceMax !== null
                  ? [{ key: "priceMax", label: `最高 HK$${input.priceMax}` }]
                  : []),
              ].map((filter) => {
                const next = searchToParams(formInput);
                next.delete(filter.key);
                next.delete("page");
                return (
                  <a key={filter.key} className="chip" href={`/search?${next}`}>
                    移除 {filter.label}
                  </a>
                );
              })}
              {input.tagIds.map((id) => {
                const next = searchToParams({
                  ...formInput,
                  tagIds: input.tagIds.filter((t) => t !== id),
                  page: 1,
                });
                return (
                  <a key={id} className="chip" href={`/search?${next}`}>
                    移除 {taxonomy.tags.find((t) => t.id === id)?.name}
                  </a>
                );
              })}
              {input.tagIds.length > 0 && (
                <span className="muted">
                  {input.tagMatchMode === "or"
                    ? "符合任一標籤"
                    : "符合所有標籤"}
                </span>
              )}
            </div>
            {input.page > Math.max(1, result.totalPages) ? (
              <div className="empty">
                <h3>這一頁已沒有結果</h3>
                <p className="muted">收錄可能已更新，請返回第一頁繼續瀏覽。</p>
                <a className="button" href={pageUrl(1)}>
                  返回第一頁
                </a>
              </div>
            ) : (
              <ListingResults items={result.items} />
            )}
            <nav className="pagination" aria-label="搜尋分頁">
              {input.page > 1 && (
                <a className="button" href={pageUrl(input.page - 1)}>
                  上一頁
                </a>
              )}
              <span>
                {input.page > Math.max(1, result.totalPages)
                  ? `所選第 ${input.page} 頁・共 ${result.totalPages} 頁`
                  : `${input.page} / ${Math.max(1, result.totalPages)}`}
              </span>
              {input.page < result.totalPages && (
                <a className="button" href={pageUrl(input.page + 1)}>
                  下一頁
                </a>
              )}
            </nav>
          </section>
        </div>
      </SearchForm>
    </div>
  );
}
