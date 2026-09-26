"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogListing, Taxonomy } from "@/server/catalog/service";
import { formatPrice } from "@/lib/directory";
import { Editor, type EditorValue } from "./Editor";
import { ImportPanel } from "./ImportPanel";
type Section =
  | "listings"
  | "categories"
  | "areas"
  | "tags"
  | "groups"
  | "navigation"
  | "imports"
  | "analytics"
  | "settings";
const labels: Record<Section, string> = {
  listings: "收錄管理",
  categories: "分類",
  areas: "地區",
  tags: "標籤",
  groups: "標籤群組",
  navigation: "導覽",
  imports: "CSV 匯入",
  analytics: "目錄統計",
  settings: "設定",
};
const emptyTaxonomy: Taxonomy = {
  categories: [],
  areas: [],
  tags: [],
  groups: [],
  navigation: [],
};
export function AdminCatalog({ section }: { section: Section }) {
  const [taxonomy, setTaxonomy] = useState<Taxonomy>(emptyTaxonomy),
    [items, setItems] = useState<CatalogListing[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [query, setQuery] = useState(""),
    [filters, setFilters] = useState({
      categoryId: "",
      areaId: "",
      tagIds: "",
      status: "all",
    }),
    [editing, setEditing] = useState<EditorValue | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        pageSize: "20",
        ...filters,
      });
      const [tr, lr] = await Promise.all([
        fetch("/api/admin/catalog?taxonomy=1"),
        fetch(`/api/admin/catalog?${params}`),
      ]);
      const [t, l] = await Promise.all([tr.json(), lr.json()]);
      if (!tr.ok || !lr.ok)
        throw new Error(t.message ?? l.message ?? "載入失敗");
      setTaxonomy(t);
      setItems(l.items);
      setTotal(l.total);
      setPages(l.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [query, page, filters]);
  useEffect(() => {
    void load();
  }, [load]);
  const start = (row?: EditorValue) =>
    setEditing(
      row
        ? {
            ...row,
            tagIds:
              row.tagIds ??
              (row.tags as { id: number }[] | undefined)?.map((t) => t.id) ??
              [],
            priceMin: row.priceMin == null ? null : Number(row.priceMin),
            priceMax: row.priceMax == null ? null : Number(row.priceMax),
            attributes: Object.entries(row.attrs ?? {}).map(([key, value]) => ({
              key,
              value,
            })),
            aliasesText: ((row.aliases as string[]) ?? []).join("\n"),
          }
        : {
            name: "",
            slug: "",
            label: "",
            enabled: section !== "listings",
            sortOrder: 0,
            publicVisible: true,
            botVisible: true,
            botFeatured: false,
            filterable: true,
            priceCurrency: "HKD",
            priceMin: null,
            priceMax: null,
            attributes: [],
            links: [],
            tagIds: [],
            aliasesText: "",
          },
    );
  const remove = async (id: number) => {
    if (!window.confirm("確定永久刪除此項目？你亦可改為停用以保留資料。"))
      return;
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: section, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    }
  };
  const manageable = !["imports", "analytics", "settings"].includes(section);
  const rows =
    section === "listings"
      ? items
      : manageable
        ? taxonomy[section as keyof Taxonomy]
        : [];
  return (
    <>
      <div className="section-heading">
        <h1>{labels[section]}</h1>
        {manageable && (
          <button className="button primary" onClick={() => start()}>
            新增{section === "listings" ? "收錄" : "項目"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}{" "}
          <button className="button" onClick={() => void load()}>
            重試
          </button>
        </p>
      )}
      {section === "listings" && (
        <>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(String(new FormData(e.currentTarget).get("q") ?? ""));
              setPage(1);
            }}
          >
            <input
              name="q"
              aria-label="搜尋收錄"
              placeholder="搜尋名称、標籤或內容"
            />
            <button className="button">搜尋</button>
            <Link className="button" href="/admin/imports">
              批次匯入
            </Link>
          </form>
          <div className="toolbar">
            {(["categoryId", "areaId", "tagIds"] as const).map((key, index) => (
              <select
                key={key}
                aria-label={["分類", "地區", "標籤"][index]}
                value={filters[key]}
                onChange={(e) => {
                  setFilters({ ...filters, [key]: e.target.value });
                  setPage(1);
                }}
              >
                <option value="">所有{["分類", "地區", "標籤"][index]}</option>
                {[taxonomy.categories, taxonomy.areas, taxonomy.tags][
                  index
                ].map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ))}
            <select
              aria-label="發佈狀態"
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
            >
              <option value="all">所有狀態</option>
              <option value="enabled">已發佈</option>
              <option value="disabled">未發佈</option>
            </select>
          </div>
        </>
      )}
      {loading ? (
        <p role="status">正在載入…</p>
      ) : manageable ? (
        <>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>名稱</th>
                  {section === "listings" && (
                    <>
                      <th>分類 / 地區</th>
                      <th>價格</th>
                      <th>標籤</th>
                    </>
                  )}
                  <th>狀態</th>
                  <th>排序</th>
                  {section === "listings" && <th>更新</th>}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const r = row as unknown as CatalogListing & {
                    label?: string;
                  };
                  return (
                    <tr key={r.id}>
                      <td data-label="名稱">
                        <strong>{r.name ?? r.label}</strong>
                      </td>
                      {section === "listings" && (
                        <>
                          <td data-label="分類 / 地區">
                            {[r.category?.name, r.area?.name]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td data-label="價格">{formatPrice(r) || "—"}</td>
                          <td data-label="標籤">
                            {r.tags.map((t) => t.name).join("、")}
                          </td>
                        </>
                      )}
                      <td data-label="狀態">
                        <span className={`status ${r.enabled ? "" : "off"}`}>
                          {r.enabled ? "啟用" : "停用"}
                        </span>
                      </td>
                      <td data-label="排序">{r.sortOrder}</td>
                      {section === "listings" && (
                        <td data-label="更新">
                          {new Date(r.updatedAt).toLocaleDateString("zh-HK")}
                        </td>
                      )}
                      <td data-label="操作">
                        <button
                          className="button"
                          onClick={() => start(row as unknown as EditorValue)}
                        >
                          編輯
                        </button>{" "}
                        <button
                          className="button danger"
                          onClick={() => void remove(r.id)}
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && (
              <p className="empty">未有項目。新增第一個{labels[section]}。</p>
            )}
          </div>
          {section === "listings" && (
            <div className="pagination">
              <button
                className="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一頁
              </button>
              <span>
                {total} 項 · {page} / {Math.max(1, pages)}
              </span>
              <button
                className="button"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                下一頁
              </button>
            </div>
          )}
        </>
      ) : null}
      {section === "imports" && <ImportPanel />}
      {section === "analytics" && (
        <section className="empty">
          <h2>{total} 項收錄</h2>
          <p>
            分類 {taxonomy.categories.length} · 地區 {taxonomy.areas.length} ·
            標籤 {taxonomy.tags.length}
          </p>
          <p className="muted">此頁顯示目錄內容統計，未收集訪客行為資料。</p>
        </section>
      )}
      {section === "settings" && (
        <>
          <p>
            管理員使用現有 HKER session 登入。網站與 Telegram 共用同一目錄。
          </p>
          <p className="muted">
            Telegram token、webhook secret 及網站網址由伺服器環境設定。
          </p>
          <button
            className="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.assign("/login");
            }}
          >
            登出
          </button>
        </>
      )}
      {editing && (
        <Editor
          kind={section}
          initial={editing}
          taxonomy={taxonomy}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}
