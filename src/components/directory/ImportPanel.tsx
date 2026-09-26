"use client";
import { useState } from "react";
type Preview = {
  digest: string;
  valid: boolean;
  items: { row: number; name: string; slug: string; errors: string[] }[];
};
export function ImportPanel() {
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const run = async (confirm = false) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, confirm, digest: preview?.digest }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "匯入失敗");
      if (confirm) {
        setMessage(`已匯入 ${result.imported} 項草稿。請檢查內容後再發佈。`);
        setPreview(null);
        setCsv("");
      } else setPreview(result);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "無法處理 CSV");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p>先預覽及驗證，再確認匯入。所有收錄以草稿建立，不會覆蓋既有資料。</p>
      <p className="muted">
        必要欄位：name、slug。可選：shortDescription、description、priceMin、priceMax、priceCurrency、categoryId、areaId、tagIds（以
        | 分隔）、website。最多 200 行 / 500 KB。
      </p>
      <label>
        上傳 CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 500000) {
                setMessage("檔案不可超過 500 KB");
                return;
              }
              setCsv(await file.text());
              setPreview(null);
            }
          }}
        />
      </label>
      <label>
        或貼上 CSV
        <textarea
          rows={9}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          placeholder={"name,slug,shortDescription,website\n"}
        />
      </label>
      <div className="toolbar">
        <button
          className="button primary"
          disabled={busy || !csv.trim()}
          onClick={() => void run()}
        >
          解析及預覽
        </button>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {preview && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>行</th>
                  <th>名稱</th>
                  <th>網址代稱</th>
                  <th>驗證</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((i) => (
                  <tr key={i.row}>
                    <td>{i.row}</td>
                    <td>{i.name}</td>
                    <td>{i.slug}</td>
                    <td>{i.errors.join("；") || "可匯入（草稿）"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button primary"
            disabled={busy || !preview.valid}
            onClick={() => void run(true)}
          >
            確認匯入 {preview.items.length} 項
          </button>
        </>
      )}
    </>
  );
}
