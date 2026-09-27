"use client";
import { useState, useEffect } from "react";
type Row = {
  source: string;
  kind: string;
  key: string;
  label?: string;
  count: number;
  zeroCount: number;
};
export function AnalyticsPanel() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [range, setRange] = useState({
      from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/analytics?${new URLSearchParams(range)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "無法載入統計");
        setRows(data.rows);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [range]);
  return (
    <>
      <p className="muted">
        觀察到的操作次數，不代表獨立訪客或成交。敏感搜尋不會保存；Telegram
        直接連結點擊不會計入。資料保留 90 日。
      </p>
      <div className="form-grid">
        <label>
          由
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          至
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>類型</th>
              <th>來源</th>
              <th>搜尋／項目</th>
              <th>操作次數</th>
              <th>零結果</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source}:${r.kind}:${r.key}`}>
                <td>
                  {
                    {
                      search: "搜尋",
                      preset: "導覽",
                      tag: "標籤",
                      outbound: "外部連結",
                    }[r.kind]
                  }
                </td>
                <td>{r.source === "web" ? "網站" : "Telegram"}</td>
                <td>{r.label ?? r.key}</td>
                <td>{r.count}</td>
                <td>{r.zeroCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty">此日期範圍尚未有可呈現的事件。</p>
        )}
      </div>
    </>
  );
}
