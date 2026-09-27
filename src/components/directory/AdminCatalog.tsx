"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogListing, Taxonomy } from "@/server/catalog/service";
import { formatPrice } from "@/lib/directory";
import { Editor, type EditorValue } from "./Editor";
import { orderAreaHierarchy as areaTree } from "@/lib/directory";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { BulkPanel, type SelectedListing } from "./BulkPanel";
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
  imports: "資料匯入",
  analytics: "使用統計",
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
      sort: "manual",
    }),
    [editing, setEditing] = useState<EditorValue | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedListing[]>([]);
  const [unavailableOnly, setUnavailableOnly] = useState(false);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const selectionScope = JSON.stringify({ query, filters, section });
  const selectionScopeRef = useRef(selectionScope);
  if (selectionScopeRef.current !== selectionScope) {
    selectionScopeRef.current = selectionScope;
    if (selected.length) setSelected([]);
  }
  const manageable = !["imports", "analytics", "settings"].includes(section);
  const activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    if (!manageable) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        pageSize: "20",
        ...filters,
      });
      const tr = await fetch("/api/admin/catalog?taxonomy=1", {
        signal: controller.signal,
      });
      const t = await tr.json();
      if (!tr.ok) throw new Error(t.message ?? "載入失敗");
      if (controller.signal.aborted || activeRequest.current !== controller)
        return;
      setTaxonomy(t);
      if (section === "listings") {
        const lr = await fetch(`/api/admin/catalog?${params}`, {
          signal: controller.signal,
        });
        const l = await lr.json();
        if (!lr.ok) throw new Error(l.message ?? "載入失敗");
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        if (page > Math.max(1, l.totalPages)) {
          setPage(Math.max(1, l.totalPages));
          return;
        }
        setItems(l.items);
        setTotal(l.total);
        setPages(l.totalPages);
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query, page, filters, section, manageable]);
  useEffect(() => {
    void load();
    return () => activeRequest.current?.abort();
  }, [load]);
  const start = (row?: EditorValue, trigger?: HTMLElement) => {
    editorTrigger.current = trigger ?? null;
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
            allowBroad:
              row.allowBroad ??
              (section === "navigation" &&
                !row.categoryId &&
                !row.areaId &&
                !(row.tagIds?.length ?? 0) &&
                row.priceMin == null &&
                row.priceMax == null),
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
            allowBroad: section === "navigation",
          },
    );
  };
  const remove = async (id: number) => {
    if (!window.confirm("確定永久刪除此項目？你亦可改為停用以保留資料。"))
      return;
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: section, id, revision: section === "listings" ? items.find(item => item.id === id)?.revision : undefined }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          `${data.message}${
            data.impact
              ? `（受影響：${Object.entries(data.impact)
                  .map(
                    ([key, count]) =>
                      `${({ listings: "收錄", presets: "導覽", children: "子地區", tags: "標籤" } as Record<string, string>)[key] ?? key} ${count}`,
                  )
                  .join("、")}）請使用停用。`
              : ""
          }`,
        );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    }
  };
  const [mutationBusy, setMutationBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [deployment, setDeployment] = useState<{
    publicUrlConfigured: boolean;
    telegramConfigured: boolean;
    webhookProtected: boolean;
  } | null>(null);
  useEffect(() => {
    if (section !== "settings") return;
    const controller = new AbortController();
    void fetch("/api/admin/catalog?settings=1", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("無法讀取部署狀態");
        setDeployment(await response.json());
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [section]);
  const mutate = async (body: object) => {
    setMutationBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "更新失敗");
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setMutationBusy(false);
    }
  };
  const rows =
    section === "listings"
      ? items
      : manageable
        ? section === "areas"
          ? areaTree(taxonomy.areas)
          : section === "navigation" && unavailableOnly
            ? taxonomy.navigation.filter((item) => item.warning)
            : taxonomy[section as keyof Taxonomy]
        : [];
  return (
    <>
      <div className="section-heading">
        <h1>{labels[section]}</h1>
        {manageable && (
          <button
            className="button primary"
            onClick={(event) => start(undefined, event.currentTarget)}
          >
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
              placeholder="搜尋名稱、標籤或內容"
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
      {section === "listings" && (
        <BulkPanel
          key={selectionScope}
          selected={selected}
          taxonomy={taxonomy}
          clear={() => setSelected([])}
          reload={() => void load()}
        />
      )}
      {loading ? (
        <p role="status">正在載入…</p>
      ) : manageable ? (
        <>
          {(section === "listings" || section === "navigation") && (
            <p className="muted">
              上移／下移只更新此頁可見項目，其他頁面與篩選外項目的排序數字保持不變。
            </p>
          )}
          {preview && <p role="status">{preview}</p>}
          {section === "listings" && <HistoryPanel />}
          {section === "listings" && (
            <button
              className="button"
              disabled={mutationBusy}
              onClick={async () => {
                try {
                  const response = await fetch(
                    `/api/admin/catalog?${new URLSearchParams({ q: query, ...filters, selection: "1" })}`,
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.message);
                  setSelected(data);
                } catch (error) {
                  setError(error instanceof Error ? error.message : "選取失敗");
                }
              }}
            >
              選取所有符合項目（上限 200）
            </button>
          )}

          {section === "listings" && selected.length > 0 && (
            <p>
              <a
                href={`/api/admin/catalog/export?format=json&ids=${selected.map((row) => row.id).join(",")}`}
              >
                匯出所選 JSON
              </a>{" "}
              ·{" "}
              <a
                href={`/api/admin/catalog/export?format=csv&ids=${selected.map((row) => row.id).join(",")}`}
              >
                匯出所選 CSV（試算表檢視）
              </a>
            </p>
          )}
          {section === "listings" && (
            <div className="toolbar">
              <button
                className="button"
                onClick={() => {
                  setFilters({ ...filters, status: "disabled" });
                  setPage(1);
                }}
              >
                未發佈內容
              </button>
              <button
                className="button"
                onClick={() => {
                  setFilters({ ...filters, sort: "updated" });
                  setPage(1);
                }}
              >
                最近變更
              </button>
            </div>
          )}
          <div className="table-wrap">
            {section === "navigation" && (
              <label>
                <input
                  type="checkbox"
                  checked={unavailableOnly}
                  onChange={(event) => setUnavailableOnly(event.target.checked)}
                />
                只顯示不可用導覽（含原因）
              </label>
            )}
            <table className="admin-table">
              <thead>
                <tr>
                  {section === "listings" && (
                    <th>
                      <input
                        type="checkbox"
                        aria-label="選取此頁"
                        checked={
                          items.length > 0 &&
                          items.every((item) =>
                            selected.some((row) => row.id === item.id),
                          )
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [
                                  ...selected,
                                  ...items
                                    .filter(
                                      (item) =>
                                        !selected.some(
                                          (row) => row.id === item.id,
                                        ),
                                    )
                                    .map(({ id, revision, name }) => ({
                                      id,
                                      revision,
                                      name,
                                    })),
                                ]
                              : selected.filter(
                                  (row) =>
                                    !items.some((item) => item.id === row.id),
                                ),
                          )
                        }
                        disabled={
                          selected.length +
                            items.filter(
                              (item) =>
                                !selected.some((row) => row.id === item.id),
                            ).length >
                          200
                        }
                      />
                    </th>
                  )}
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
                {rows.map((row, rowIndex) => {
                  const r = row as unknown as CatalogListing & {
                    label?: string;
                  };
                  return (
                    <tr key={r.id}>
                      {section === "listings" && (
                        <td data-label="選取">
                          <input
                            type="checkbox"
                            aria-label={`選取${r.name}`}
                            checked={selected.some((row) => row.id === r.id)}
                            disabled={
                              selected.length >= 200 &&
                              !selected.some((row) => row.id === r.id)
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [
                                      ...selected,
                                      {
                                        id: r.id,
                                        name: r.name,
                                        revision: r.revision,
                                      },
                                    ]
                                  : selected.filter((row) => row.id !== r.id),
                              )
                            }
                          />
                        </td>
                      )}
                      <td data-label="名稱">
                        <strong
                          style={
                            "depth" in row
                              ? { paddingInlineStart: row.depth * 16 }
                              : undefined
                          }
                        >
                          {r.name ?? r.label}
                        </strong>
                        {"warning" in row && row.warning && (
                          <p className="error-message">{row.warning}</p>
                        )}
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
                      <td data-label="排序">
                        {r.sortOrder}
                        {(section === "listings" || section === "navigation") &&
                          [-1, 1].map((direction) => (
                            <button
                              key={direction}
                              className="button"
                              aria-label={`${direction < 0 ? "上移" : "下移"}${r.name ?? r.label}`}
                              disabled={
                                mutationBusy ||
                                rowIndex + direction < 0 ||
                                rowIndex + direction >= rows.length
                              }
                              onClick={() => {
                                const ids = rows.map((item) => item.id);
                                [ids[rowIndex], ids[rowIndex + direction]] = [
                                  ids[rowIndex + direction],
                                  ids[rowIndex],
                                ];
                                void mutate({
                                  action: "reorder",
                                  kind: section,
                                  ids,
                                  entries: rows.map((item) => ({
                                    id: item.id,
                                    sortOrder: item.sortOrder,
                                    revision:
                                      "revision" in item
                                        ? item.revision
                                        : undefined,
                                  })),
                                });
                              }}
                            >
                              {direction < 0 ? "上移" : "下移"}
                            </button>
                          ))}
                      </td>
                      {section === "listings" && (
                        <td data-label="更新">
                          {new Date(r.updatedAt).toLocaleDateString("zh-HK")}
                        </td>
                      )}
                      <td data-label="操作">
                        {section === "listings" && <HistoryPanel id={r.id} />}
                        <button
                          className="button"
                          onClick={(event) =>
                            start(
                              row as unknown as EditorValue,
                              event.currentTarget,
                            )
                          }
                        >
                          編輯
                        </button>{" "}
                        <button
                          className="button"
                          disabled={mutationBusy}
                          onClick={() =>
                            void mutate({
                              action: "publish",
                              kind: section,
                              id: r.id,
                              enabled: !r.enabled,
                              revision: r.revision,
                            })
                          }
                        >
                          {section === "listings"
                            ? r.enabled
                              ? "取消發佈"
                              : "發佈"
                            : r.enabled
                              ? "停用"
                              : "啟用"}
                        </button>{" "}
                        {section === "navigation" &&
                          (["public", "bot"] as const).map((audience) => (
                            <button
                              key={audience}
                              className="button"
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `/api/admin/catalog?preview=${r.id}&audience=${audience}`,
                                  );
                                  const data = await response.json();
                                  if (!response.ok)
                                    throw new Error(data.message ?? "預覽失敗");
                                  setPreview(
                                    data.available
                                      ? `${audience === "bot" ? "Telegram" : "網站"}預覽：${data.total} 個結果${data.items.length ? ` · ${data.items.join("、")}` : ""}`
                                      : data.message,
                                  );
                                } catch (error) {
                                  setError(
                                    error instanceof Error
                                      ? error.message
                                      : "預覽失敗",
                                  );
                                }
                              }}
                            >
                              {audience === "bot"
                                ? "預覽 Telegram"
                                : "預覽網站"}
                            </button>
                          ))}
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
      {section === "analytics" && <AnalyticsPanel />}
      {section === "settings" && (
        <>
          <h2>部署設定狀態</h2>
          {deployment ? (
            <dl>
              <dt>公開網站網址</dt>
              <dd>{deployment.publicUrlConfigured ? "已設定" : "尚未設定"}</dd>
              <dt>Telegram Bot</dt>
              <dd>
                {deployment.telegramConfigured
                  ? "已設定 Token（不代表已連線驗證）"
                  : "尚未設定"}
              </dd>
              <dt>Webhook 保護</dt>
              <dd>
                {deployment.webhookProtected
                  ? "已設定密鑰"
                  : "尚未設定；Webhook 將拒絕請求"}
              </dd>
            </dl>
          ) : (
            <p role="status">正在讀取部署設定…</p>
          )}
          <p>
            網站與 Telegram 共用同一目錄。設定狀態不代表正式環境驗收已完成。
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
          returnFocus={editorTrigger.current}
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
