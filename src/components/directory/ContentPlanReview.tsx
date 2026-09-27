"use client";
export type ContentPlan = {
  id: string;
  digest: string;
  kind: string;
  expiresAt: string;
  payload: {
    source?: string;
    mappingEffects?: { kind: string; value: string; id: number; affected: number }[];
    settings?: {
      mappings?: import("./ImportMapping").ImportMapping[];
      columns?: Record<string, string>;
      mode: "create" | "update";
      decisions: Record<string, "accept" | "skip">;
      linksMode: "append" | "replace";
      tagsMode: "append" | "replace";
      clear: string[];
    };
    rows?: {
      summary?: { category: string; area: string; tags: string[] };
      candidates?: {
        id: number;
        name: string;
        slug: string;
        revision: number;
        area: string | null;
      }[];
      row: number;
      name: string;
      slug: string;
      errors: string[];
      warnings: string[];
      data: {
        categoryId: number | null;
        areaId: number | null;
        priceMin: number | null;
        priceMax: number | null;
        priceCurrency: string;
        links: unknown[];
        tagIds: number[];
      } | null;
      diff?: Record<string, { before: unknown; after: unknown }>;
    }[];
  };
  result: {
    created: number;
    updated: number;
    skipped: number;
    unchanged: number;
    affected: { id: number; slug: string; enabled: boolean }[];
  } | null;
};
export async function contentRequest(body?: unknown, id?: string) {
  const response = await fetch(
    `/api/admin/catalog/operations${id ? `?id=${encodeURIComponent(id)}` : ""}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "無法處理操作");
  return result;
}
export function ContentPlanReview({ plan }: { plan: ContentPlan }) {
  if (plan.result)
    return (
      <p role="status">
        已完成：新增 {plan.result.created}、更新 {plan.result.updated}、未變更{" "}
        {plan.result.unchanged}、略過 {plan.result.skipped}。
        {plan.result.affected.filter((row) => row.enabled).length} 項為已發佈。
      </p>
    );
  return (
    <>
      <p>
        計畫有效至 {new Date(plan.expiresAt).toLocaleString("zh-HK")}
        。確認時仍會檢查最新版本；衝突時整批不會寫入。
      </p>
      {plan.payload.mappingEffects?.map(mapping => <p key={`${mapping.kind}:${mapping.value}`}>{mapping.kind}「{mapping.value}」對照影響 {mapping.affected} 行。</p>)}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>行／名稱</th>
              <th>內容摘要</th>
              <th>驗證與變更</th>
            </tr>
          </thead>
          <tbody>
            {plan.payload.rows?.map((row) => (
              <tr key={row.row}>
                <td data-label="行／名稱">
                  {row.row} · {row.name}
                  <br />
                  <small>{row.slug}</small>
                </td>
                <td data-label="內容摘要">
                  {row.summary?.category ?? "無分類"} · {row.summary?.area ?? "無地區"}
                  <br />
                  {row.data?.priceCurrency} {row.data?.priceMin ?? "未填"} –{" "}
                  {row.data?.priceMax ?? "未填"}
                  <br />
                  {row.summary?.tags.join("、") || "無標籤"} ·{" "}
                  {row.data?.links.length ?? 0} 個連結
                </td>
                <td data-label="驗證與變更">
                  {plan.payload.settings?.decisions[row.row] === "skip"
                    ? "已略過"
                    : row.errors.join("；") ||
                      row.warnings.join("；") ||
                      "可確認"}
                  {row.candidates?.length ? (
                    <details>
                      <summary>
                        可能相似的收錄（{row.candidates.length}）
                      </summary>
                      {row.candidates.map((candidate) => (
                        <p key={candidate.id}>
                          {candidate.name} · {candidate.area ?? "無地區"} ·{" "}
                          {candidate.slug} · v{candidate.revision}
                        </p>
                      ))}
                    </details>
                  ) : null}
                  {row.diff && (
                    <details>
                      <summary>
                        欄位變更（{Object.keys(row.diff).length}）
                      </summary>
                      {Object.entries(row.diff).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}</strong>
                          <p>原值：{JSON.stringify(value.before)}</p>
                          <p>新值：{JSON.stringify(value.after)}</p>
                        </div>
                      ))}
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
