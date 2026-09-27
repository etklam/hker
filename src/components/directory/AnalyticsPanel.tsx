"use client";
import { useState, useEffect } from "react";

type Row = {
  source: string;
  kind: string;
  key: string;
  label?: string;
  count: number;
  zeroCount: number;
  queryLabelEligible: boolean;
};
type Report = {
  rows: Row[];
  summary: {
    searches: number;
    zeroResults: number;
    zeroRate: number | null;
    filteredDiscoveries: number;
    suppressedSearches: number;
  };
  collection: {
    status: "enabled" | "disabled" | "degraded";
    timeZone: string;
    retentionDays: number;
    collectionStart: string | null;
    todayIncomplete: boolean;
  };
  meaning: string;
};

const day = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const number = new Intl.NumberFormat("zh-HK");
const percent = new Intl.NumberFormat("zh-HK", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function AnalyticsPanel() {
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [range, setRange] = useState({
      from: day(new Date(Date.now() - 30 * 86400000)),
      to: day(new Date()),
      source: "all",
    });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/analytics?${new URLSearchParams(range)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "無法載入統計");
        setReport(data);
        setError("");
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") {
          setReport(null);
          setError(`${cause.message}。請稍後重試。`);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, refresh]);

  const deleteQuery = async (query: string) => {
    if (!window.confirm(`刪除「${query}」的已儲存統計？歷史計數將無法復原。`))
      return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/analytics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "無法刪除搜尋統計");
      setRefresh((value) => value + 1);
    } catch (cause) {
      setLoading(false);
      setError(
        `${cause instanceof Error ? cause.message : "無法刪除搜尋統計"}。請稍後重試。`,
      );
    }
  };

  const statusMessage =
    report?.collection.status === "disabled"
      ? "探索統計目前已停用。搜尋及外部連結仍可正常使用。"
      : report?.collection.status === "degraded"
        ? "探索統計目前無法讀取。下方空白不代表沒有需求，請檢查資料庫及清理工作。"
        : "";

  return (
    <>
      <p className="muted">
        只計算獲准的明確操作，不代表獨立訪客、推薦、成交或商戶品質。敏感搜尋只加入隱藏總數，不保存文字；Telegram
        直接 URL 按鈕點擊不可觀測。
      </p>
      <div className="form-grid">
        <label>
          由
          <input
            type="date"
            value={range.from}
            onChange={(event) =>
              setRange({ ...range, from: event.target.value })
            }
          />
        </label>
        <label>
          至
          <input
            type="date"
            value={range.to}
            onChange={(event) =>
              setRange({ ...range, to: event.target.value })
            }
          />
        </label>
        <label>
          來源
          <select
            value={range.source}
            onChange={(event) =>
              setRange({ ...range, source: event.target.value })
            }
          >
            <option value="all">網站及 Telegram</option>
            <option value="web">網站</option>
            <option value="bot">Telegram</option>
          </select>
        </label>
      </div>
      {loading && <p role="status">正在載入探索統計…</p>}
      {error && <p role="alert">{error}</p>}
      {statusMessage && <p role="status" className="notice">{statusMessage}</p>}
      {report?.collection.status === "enabled" && (
        <>
          <p className="muted">
            香港時間（{report.collection.timeZone}）· 保留 {report.collection.retentionDays} 日
            {report.collection.collectionStart
              ? ` · 開始收集：${report.collection.collectionStart}`
              : " · 尚未收集事件"}
            {report.collection.todayIncomplete ? " · 今日資料未完整" : ""}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>已提交文字搜尋</th>
                  <th>零結果</th>
                  <th>零結果率</th>
                  <th>結構化探索</th>
                  <th>隱藏文字</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{number.format(report.summary.searches)}</td>
                  <td>{number.format(report.summary.zeroResults)}</td>
                  <td>
                    {report.summary.zeroRate === null
                      ? "沒有分母"
                      : percent.format(report.summary.zeroRate)}
                  </td>
                  <td>{number.format(report.summary.filteredDiscoveries)}</td>
                  <td>{number.format(report.summary.suppressedSearches)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>類型</th>
                  <th>來源</th>
                  <th>搜尋／項目</th>
                  <th>操作次數</th>
                  <th>零結果</th>
                  <th>管理</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={`${row.source}:${row.kind}:${row.key}`}>
                    <td>
                      {{
                        search: "文字搜尋",
                        filter: "結構化探索",
                        preset: "導覽",
                        tag: "標籤",
                        outbound: "外部連結",
                      }[row.kind] ?? row.kind}
                    </td>
                    <td>{row.source === "web" ? "網站" : "Telegram"}</td>
                    <td>
                      {row.kind === "search" && row.queryLabelEligible ? (
                        <a href={`/search?q=${encodeURIComponent(row.key)}`}>
                          {row.label ?? row.key}
                        </a>
                      ) : (
                        row.label ?? row.key
                      )}
                    </td>
                    <td>{number.format(row.count)}</td>
                    <td>{number.format(row.zeroCount)}</td>
                    <td>
                      {row.kind === "search" && row.queryLabelEligible ? (
                        <button
                          className="button danger"
                          disabled={loading}
                          onClick={() => void deleteQuery(row.key)}
                          aria-label={`刪除「${row.label ?? row.key}」的搜尋統計`}
                        >
                          刪除統計
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!report.rows.length && (
              <p className="empty">
                此日期及來源範圍尚未有獲准的探索操作。這不包括已停用或遺失的量測。
              </p>
            )}
          </div>
          <p className="muted">{report.meaning}</p>
        </>
      )}
    </>
  );
}
