"use client";
import { useEffect, useState } from "react";
import { ImportMappingPanel, type ImportMapping } from "./ImportMapping";
import {
  ContentPlanReview,
  contentRequest,
  type ContentPlan,
} from "./ContentPlanReview";
export function ImportPanel() {
  const [mappings, setMappings] = useState<ImportMapping[]>([]);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");
  const [linksMode, setLinksMode] = useState<"append" | "replace">("append");
  const [tagsMode, setTagsMode] = useState<"append" | "replace">("append");
  const [clear, setClear] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "accept" | "skip">>(
    {},
  );
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [recent, setRecent] = useState<
    { id: string; kind: string; createdAt: string }[]
  >([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [taxonomyPlan, setTaxonomyPlan] = useState<ContentPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    contentRequest()
      .then(setRecent)
      .catch((error) => setMessage(error.message));
  }, []);
  const recover = async (id: string) => {
    setBusy(true);
    try {
      const restored: ContentPlan = await contentRequest(undefined, id);
      setPlan(restored);
      setDirty(false);
      if (restored.payload.source) setSource(restored.payload.source);
      if (restored.payload.settings) {
        const settings = restored.payload.settings;
        setMode(settings.mode);
        setDecisions(settings.decisions);
        setLinksMode(settings.linksMode);
        setTagsMode(settings.tagsMode);
        setClear(settings.clear);
        setMappings(settings.mappings ?? []);
        setColumns(settings.columns ?? {});
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法恢復");
    } finally {
      setBusy(false);
    }
  };
  const run = async (confirm = false) => {
    setBusy(true);
    setMessage("");
    try {
      if (confirm && plan) {
        await contentRequest({
          action: "commit",
          id: plan.id,
          digest: plan.digest,
        });
        await recover(plan.id);
      } else {
        setPlan(
          await contentRequest({
            action: "import",
            source,
            settings: {
              mode,
              linksMode,
              tagsMode,
              clear,
              decisions,
              mappings,
              columns,
            },
          }),
        );
        setDirty(false);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "無法處理匯入；可查詢操作狀態或重新預覽",
      );
    } finally {
      setBusy(false);
    }
  };
  const rows = plan?.payload.rows ?? [];
  const selected = rows.filter((row) => decisions[row.row] !== "skip");
  const ready = selected.filter(
    (row) =>
      !row.errors.length &&
      (!row.warnings.length || decisions[row.row] === "accept"),
  );
  return (
    <>
      <p>
        上傳或貼上 → 預覽及處理警告 → 重新預覽選取內容 →
        確認。新收錄一律建立草稿。上限 200 行／500 KB，僅接受 UTF-8。
      </p>
      <p>
        <a href="/directory-import-simple-v2.csv" download>
          簡易 CSV 範本
        </a>{" "}
        ·{" "}
        <a href="/directory-import-advanced-v2.csv" download>
          進階 CSV 範本
        </a>
      </p>
      <details>
        <summary>格式與更新規則</summary>
        <p>
          擴充 CSV 每行 formatVersion=2。categorySlug、areaSlug、tagSlugs
          使用代稱，標籤以 | 分隔。linksJson、aliasesJson、attrsJson 使用
          JSON；CSV 雙引號重複跳脫。linksJson 不可與
          website、telegram、instagram
          同時填寫。省略或留白不會清除既有欄位。更新只以既有精確 slug
          配對，保留發佈狀態。
        </p>
      </details>
      <ImportMappingPanel
        mappings={mappings}
        columns={columns}
        change={(next, mapped) => {
          setMappings(next);
          setColumns(mapped);
          setDirty(true);
        }}
      />
      <label>
        操作模式
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            setDirty(true);
          }}
        >
          <option value="create">建立草稿（預設）</option>
          <option value="update">更新既有收錄</option>
        </select>
      </label>
      {mode === "update" && (
        <>
          <div className="form-grid">
            <label>
              連結處理
              <select
                value={linksMode}
                onChange={(e) => {
                  setLinksMode(e.target.value as typeof linksMode);
                  setDirty(true);
                }}
              >
                <option value="append">附加，保留既有連結</option>
                <option value="replace">
                  取代，確認差異後移除未列出的連結
                </option>
              </select>
            </label>
            <label>
              標籤處理
              <select
                value={tagsMode}
                onChange={(e) => {
                  setTagsMode(e.target.value as typeof tagsMode);
                  setDirty(true);
                }}
              >
                <option value="append">附加</option>
                <option value="replace">取代</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>明確清除欄位（套用至所選更新行）</legend>
            {[
              "shortDescription",
              "description",
              "categoryId",
              "areaId",
              "priceMin",
              "priceMax",
              "aliases",
              "attrs",
            ].map((field) => (
              <label className="check" key={field}>
                <input
                  type="checkbox"
                  checked={clear.includes(field)}
                  onChange={(e) => {
                    setClear(
                      e.target.checked
                        ? [...clear, field]
                        : clear.filter((value) => value !== field),
                    );
                    setDirty(true);
                  }}
                />
                {field}
              </label>
            ))}
          </fieldset>
        </>
      )}
      <label>
        上傳 CSV／JSON
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 500000)
                throw new Error("檔案超過 500 KB；請分割檔案");
              const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
                await file.arrayBuffer(),
              );
              setSource(decoded);
              setTaxonomyPlan(null);
              setPlan(null);
              setDecisions({});
              setDirty(true);
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "請使用 UTF-8",
              );
            }
          }}
        />
      </label>
      <label>
        或貼上 CSV／JSON
        <textarea
          rows={8}
          value={source}
          disabled={busy}
          onChange={(e) => {
            setSource(e.target.value);
            setTaxonomyPlan(null);
            setDirty(true);
          }}
        />
      </label>
      <button
        className="button primary"
        disabled={busy || !source.trim()}
        onClick={() => void run()}
      >
        解析及預覽
      </button>
      {source.trimStart().startsWith("{") && (
        <section aria-label="JSON 分類匯入">
          <p>
            先檢查 JSON
            所需的分類、地區、群組、標籤與導覽。只建立缺少的項目，不會覆蓋同代稱的既有設定。
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setTaxonomyPlan(
                  await contentRequest({ action: "taxonomy", source }),
                );
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "預覽失敗");
              } finally {
                setBusy(false);
              }
            }}
          >
            預覽缺少的分類資料
          </button>
          {taxonomyPlan && (
            <>
              <details open>
                <summary>確切建立清單</summary>
                <pre
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {JSON.stringify(
                    (
                      taxonomyPlan.payload as unknown as {
                        preview?: { creates: unknown };
                      }
                    ).preview?.creates,
                    null,
                    2,
                  )}
                </pre>
              </details>
              {!taxonomyPlan.result && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await contentRequest({
                        action: "commit",
                        id: taxonomyPlan.id,
                        digest: taxonomyPlan.digest,
                      });
                      setTaxonomyPlan(
                        await contentRequest(undefined, taxonomyPlan.id),
                      );
                      setDirty(true);
                      setMessage("分類資料已建立；請重新預覽 Listing 匯入。");
                    } catch (error) {
                      setMessage(
                        error instanceof Error ? error.message : "提交失敗",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  確認建立缺少的分類資料
                </button>
              )}
              {taxonomyPlan.result && (
                <p role="status">
                  已建立 {taxonomyPlan.result.created} 項分類資料。
                </p>
              )}
            </>
          )}
        </section>
      )}
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      {plan && (
        <section aria-label="匯入預覽">
          <ContentPlanReview plan={plan} />
          {!plan.result && (
            <>
              <fieldset>
                <legend>逐行處理</legend>
                {rows.map((row) => (
                  <label key={row.row}>
                    第 {row.row} 行 · {row.name}
                    <select
                      value={decisions[row.row] ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        const next = { ...decisions };
                        if (e.target.value)
                          next[row.row] = e.target.value as "accept" | "skip";
                        else delete next[row.row];
                        setDecisions(next);
                        setDirty(true);
                      }}
                    >
                      <option value="">
                        {row.errors.length
                          ? "修正或略過"
                          : row.warnings.length
                            ? "需要明確決定"
                            : "正常匯入"}
                      </option>
                      {!row.errors.length && (
                        <option value="accept">接受並匯入</option>
                      )}
                      <option value="skip">略過</option>
                    </select>
                  </label>
                ))}
              </fieldset>
              <p role="status">
                選取 {selected.length} 行，可確認 {ready.length} 行。
                {dirty && "內容或決定已改變，請重新預覽。"}
              </p>
              <button
                className="button primary"
                disabled={
                  busy ||
                  dirty ||
                  !selected.length ||
                  ready.length !== selected.length
                }
                onClick={() => void run(true)}
              >
                確認匯入 {selected.length} 項
              </button>
            </>
          )}
          <button
            className="button"
            disabled={busy}
            onClick={() => void recover(plan.id)}
          >
            查詢操作狀態
          </button>
        </section>
      )}
      <details>
        <summary>恢復近期計畫</summary>
        {recent
          .filter((item) => item.kind === "import")
          .map((item) => (
            <p key={item.id}>
              <button
                className="button"
                disabled={busy}
                onClick={() => void recover(item.id)}
              >
                {new Date(item.createdAt).toLocaleString("zh-HK")} · 恢復
              </button>
            </p>
          ))}
      </details>
    </>
  );
}
