"use client";
import { useState } from "react";
import type { Taxonomy } from "@/server/catalog/service";
import {
  contentRequest,
  ContentPlanReview,
  type ContentPlan,
} from "./ContentPlanReview";
export type SelectedListing = { id: number; revision: number; name: string };
export function BulkPanel({
  selected,
  taxonomy,
  clear,
  reload,
}: {
  selected: SelectedListing[];
  taxonomy: Taxonomy;
  clear: () => void;
  reload: () => void;
}) {
  const [action, setAction] = useState("publish"),
    [value, setValue] = useState("");
  const [plan, setPlan] = useState<ContentPlan | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const preview = async () => {
    setBusy(true);
    setMessage("");
    try {
      const patch =
        action === "publish"
          ? { enabled: true }
          : action === "unpublish"
            ? { enabled: false }
            : action === "feature"
              ? { featured: true }
              : action === "unfeature"
                ? { featured: false }
                : action === "addTags" || action === "removeTags"
                  ? { [action]: [Number(value)] }
                  : { [action]: value === "" ? null : Number(value) };
      setPlan(
        await contentRequest({
          action: "bulk",
          input: {
            entries: selected.map(({ id, revision }) => ({ id, revision })),
            patch,
          },
        }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "預覽失敗");
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await contentRequest({
        action: "commit",
        id: plan.id,
        digest: plan.digest,
      });
      setPlan(await contentRequest(undefined, plan.id));
      clear();
      reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "提交失敗；可查詢操作狀態",
      );
    } finally {
      setBusy(false);
    }
  };
  const choices =
    action === "categoryId"
      ? taxonomy.categories
      : action === "areaId"
        ? taxonomy.areas
        : taxonomy.tags;
  return (
    <section aria-label="批次操作">
      <p>
        已選取 {selected.length} 項（含其他頁面，最多 200
        項）。更改搜尋或篩選會清除選取。
      </p>
      {selected.length > 0 && (
        <details>
          <summary>查看確切選取範圍</summary>
          <p>
            {selected
              .map((item) => `${item.name} (#${item.id}, v${item.revision})`)
              .join("、")}
          </p>
        </details>
      )}
      <div className="toolbar">
        <button className="button" onClick={clear} disabled={busy}>
          清除選取
        </button>
        <label>
          批次操作
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPlan(null);
              setValue("");
            }}
            disabled={busy}
          >
            <option value="publish">發佈</option>
            <option value="unpublish">取消發佈</option>
            <option value="feature">設為精選</option>
            <option value="unfeature">取消精選</option>
            <option value="categoryId">設定／清除分類</option>
            <option value="areaId">設定／清除地區</option>
            <option value="addTags">加入標籤</option>
            <option value="removeTags">移除標籤</option>
            <option value="sortOrder">設定排序數字</option>
          </select>
        </label>
        {["categoryId", "areaId", "addTags", "removeTags"].includes(action) && (
          <label>
            目標
            <select
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setPlan(null);
              }}
            >
              <option value="">
                {action.endsWith("Id") ? "明確清除" : "選擇標籤"}
              </option>
              {choices.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} · {item.slug}
                </option>
              ))}
            </select>
          </label>
        )}
        {action === "sortOrder" && (
          <label>
            排序數字
            <input
              type="number"
              min={-1000000}
              max={1000000}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setPlan(null);
              }}
            />
          </label>
        )}
        <button
          className="button primary"
          disabled={
            busy ||
            !selected.length ||
            ((action === "sortOrder" || action.endsWith("Tags")) && !value)
          }
          onClick={() => void preview()}
        >
          預覽批次變更
        </button>
      </div>
      {message && <p role="alert">{message}</p>}
      {plan && (
        <>
          <ContentPlanReview plan={plan} />
          {!plan.result && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void commit()}
            >
              確認變更 {plan.payload.rows?.length} 項
            </button>
          )}
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              try {
                setPlan(await contentRequest(undefined, plan.id));
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "查詢失敗");
              }
            }}
          >
            查詢操作狀態
          </button>
        </>
      )}
    </section>
  );
}
