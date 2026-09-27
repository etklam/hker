"use client";
import { useState } from "react";
type Preview = {
  digest: string;
  valid: boolean;
  items: {
    row: number;
    name: string;
    slug: string;
    errors: string[];
    warnings: string[];
  }[];
};
export function ImportPanel() {
  const [decisions, setDecisions] = useState<Record<string, "accept" | "skip">>(
    {},
  );
  const [requestKey, setRequestKey] = useState("");
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
        body: JSON.stringify({
          csv,
          confirm,
          digest: preview?.digest,
          decisions,
          requestKey: requestKey || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "匯入失敗");
      if (confirm) {
        setMessage(`已匯入 ${result.imported} 項草稿。請檢查內容後再發佈。`);
        setPreview(null);
        setCsv("");
      } else {
        setPreview(result);
        setDecisions({});
        setRequestKey(crypto.randomUUID());
      }
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
        必要欄位：name。slug
        留空會自動產生。可選：category、area（代稱或唯一名稱）、tags（|
        分隔）；舊 categoryId、areaId、tagIds 仍支援。links、aliases、attrs 使用
        JSON；價格為 priceMin、priceMax、priceCurrency。tagIds（以 |
        分隔）、website。最多 200 行 / 500 KB。
      </p>
      <p>
        <a href="/directory-import-template.csv" download>
          下載 CSV 範本
        </a>
        。links 為陣列，例如 [
        {'"type":"website","label":"網站","url":"https://example.com/"'}
        ]；aliases 為字串陣列，attrs 為文字鍵值物件。CSV 內 JSON
        的雙引號須重複跳脫。
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
                    <td>
                      {i.errors.join("；") ||
                        i.warnings.join("；") ||
                        "可匯入（草稿）"}
                      <label>
                        此行處理
                        <select
                          aria-label={`第 ${i.row} 行處理`}
                          value={decisions[i.row] ?? ""}
                          onChange={(e) =>
                            setDecisions((previous) => ({
                              ...previous,
                              [i.row]: e.target.value as "accept" | "skip",
                            }))
                          }
                        >
                          <option value="">
                            {i.errors.length
                              ? "需要修正或略過"
                              : i.warnings.length
                                ? "請明確選擇"
                                : "正常匯入"}
                          </option>
                          {!i.errors.length && (
                            <option value="accept">接受並匯入</option>
                          )}
                          <option value="skip">略過</option>
                        </select>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button primary"
            disabled={
              busy ||
              preview.items.some(
                (i) =>
                  decisions[i.row] !== "skip" &&
                  (i.errors.length > 0 ||
                    (i.warnings.length > 0 && decisions[i.row] !== "accept")),
              )
            }
            onClick={() => void run(true)}
          >
            確認匯入 {preview.items.length} 項
          </button>
        </>
      )}
    </>
  );
}
