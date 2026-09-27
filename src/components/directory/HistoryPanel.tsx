"use client";
import { useState } from "react";
type Change = {
  id: string;
  entity: string;
  entityId: number;
  action: string;
  actorId: number | null;
  createdAt: string;
  beforeRevision: number | null;
  afterRevision: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
};
export function HistoryPanel({ id }: { id?: number }) {
  const [rows, setRows] = useState<Change[]>([]),
    [message, setMessage] = useState("");
  const load = async () => {
    setMessage("載入中…");
    try {
      const response = await fetch(
        `/api/admin/catalog/history${id ? `?id=${id}` : ""}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setRows(data);
      setMessage(data.length ? "" : "尚無變更記錄");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "載入失敗");
    }
  };
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>{id ? "近期變更" : "內容變更記錄（最近 100 筆）"}</summary>
      <p>記錄用於調查變更，長內容可能截斷；不提供自動復原。</p>
      {message && <p role="status">{message}</p>}
      {rows.map((row) => (
        <details key={row.id}>
          <summary>
            {new Date(row.createdAt).toLocaleString("zh-HK")} · {row.entity} #
            {row.entityId} · {row.action} · v{row.beforeRevision ?? "—"} → v
            {row.afterRevision ?? "—"}
          </summary>
          <p>編輯者 #{row.actorId ?? "系統"}</p>
          {Object.entries(row.changes).map(([field, value]) => (
            <div key={field}>
              <strong>{field}</strong>
              <p>原值：{JSON.stringify(value.before)}</p>
              <p>新值：{JSON.stringify(value.after)}</p>
            </div>
          ))}
        </details>
      ))}
    </details>
  );
}
