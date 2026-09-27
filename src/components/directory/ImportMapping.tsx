"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Taxonomy } from "@/server/catalog/service";
export type ImportMapping = {
  kind: "category" | "area" | "tag";
  value: string;
  id: number;
};
export function ImportMappingPanel({
  mappings,
  columns,
  change,
}: {
  mappings: ImportMapping[];
  columns: Record<string, string>;
  change: (mappings: ImportMapping[], columns: Record<string, string>) => void;
}) {
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null),
    [error, setError] = useState("");
  const [kind, setKind] = useState<ImportMapping["kind"]>("category"),
    [value, setValue] = useState(""),
    [id, setId] = useState("");
  const [lookup, setLookup] = useState("");
  const [header, setHeader] = useState(""),
    [target, setTarget] = useState("name");
  useEffect(() => {
    fetch("/api/admin/catalog?taxonomy=1")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        setTaxonomy(data);
      })
      .catch((error) => setError(error.message));
  }, []);
  const choices =
    taxonomy?.[
      kind === "category" ? "categories" : kind === "area" ? "areas" : "tags"
    ] ?? [];
  return (
    <details>
      <summary>欄位與分類對照（修改後須重新預覽）</summary>
      {error && <p role="alert">{error}</p>}
      <div className="form-grid">
        <label>
          來源欄位名稱
          <input value={header} onChange={(e) => setHeader(e.target.value)} />
        </label>
        <label>
          對應欄位
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {[
              "name",
              "slug",
              "shortDescription",
              "description",
              "category",
              "area",
              "tags",
              "website",
              "priceMin",
              "priceMax",
              "priceCurrency",
              "links",
              "aliases",
              "attrs",
            ].map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="button"
        disabled={!header.trim()}
        onClick={() => {
          change(mappings, { ...columns, [header.trim()]: target });
          setHeader("");
        }}
      >
        加入欄位對照
      </button>
      {Object.entries(columns).map(([from, to]) => (
        <p key={from}>
          {from} → {to}{" "}
          <button
            className="button"
            onClick={() => {
              const next = { ...columns };
              delete next[from];
              change(mappings, next);
            }}
          >
            移除對照
          </button>
        </p>
      ))}
      <div className="form-grid">
        <label>
          分類類型
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setId("");
            }}
          >
            <option value="category">分類</option>
            <option value="area">地區</option>
            <option value="tag">標籤</option>
          </select>
        </label>
        <label>
          來源值（精確比對）
          <input value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label>搜尋現有分類項目<input value={lookup} onChange={e => setLookup(e.target.value)} /></label>
        <label>
          現有項目
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">請選擇</option>
            {choices
              .filter((item) => item.enabled && (item.id === Number(id) || `${item.name} ${item.slug}`.toLocaleLowerCase().includes(lookup.trim().toLocaleLowerCase())))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.slug}
                </option>
              ))}
          </select>
        </label>
      </div>
      <button
        className="button"
        disabled={!id || !value.trim()}
        onClick={() => {
          change(
            [
              ...mappings.filter(
                (item) => item.kind !== kind || item.value !== value.trim(),
              ),
              { kind, value: value.trim(), id: Number(id) },
            ],
            columns,
          );
          setValue("");
        }}
      >
        加入分類對照
      </button>
      {mappings.map((item, index) => (
        <p key={`${item.kind}:${item.value}`}>
          {item.kind}: {item.value} → #{item.id}{" "}
          <button
            className="button"
            onClick={() =>
              change(
                mappings.filter((_, i) => i !== index),
                columns,
              )
            }
          >
            移除對照
          </button>
        </p>
      ))}
      <p>
        找不到合適項目時，請先到<Link href="/admin/tags">標籤</Link>、
        <Link href="/admin/categories">分類</Link>或
        <Link href="/admin/areas">地區</Link>
        明確建立，再重新預覽；不會自動建立未知詞。
      </p>
    </details>
  );
}
