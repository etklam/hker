"use client";
import { useState } from "react";
import type { Taxonomy } from "@/server/catalog/service";

export function TagPicker({
  taxonomy,
  selected,
  onChange,
  admin = false,
}: {
  taxonomy: Taxonomy;
  selected: number[];
  onChange?: (ids: number[]) => void;
  admin?: boolean;
}) {
  const [local, setLocal] = useState(selected);
  const [query, setQuery] = useState("");
  const ids = onChange ? selected : local;
  const key = query.normalize("NFKC").toLocaleLowerCase().trim();
  const tags = taxonomy.tags.filter(
    (tag) =>
      (admin || tag.filterable) &&
      (!key ||
        [tag.name, ...tag.aliases].some((text) =>
          text.normalize("NFKC").toLocaleLowerCase().includes(key),
        )),
  );
  const groups = [
    ...taxonomy.groups.map((g) => ({
      id: g.id as number | null,
      name: g.name,
    })),
    { id: null, name: "其他標籤" },
  ];
  return (
    <fieldset className="tag-picker">
      <legend>標籤（已選 {ids.length}，最多 50）</legend>
      {!onChange &&
        ids.map((id) => (
          <input key={id} type="hidden" name="tagIds" value={id} />
        ))}
      <input
        type="search"
        aria-label="搜尋標籤或別名"
        placeholder="搜尋標籤或別名"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="tag-picker-options">
        {groups.map((group) => {
          const entries = tags.filter((tag) =>
            group.id === null
              ? tag.groupId === null ||
                !taxonomy.groups.some((g) => g.id === tag.groupId)
              : tag.groupId === group.id,
          );
          return entries.length ? (
            <div key={group.id ?? "other"}>
              <strong>{group.name}</strong>
              {entries.map((tag) => (
                <label className="check" key={tag.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(tag.id)}
                    disabled={!ids.includes(tag.id) && ids.length >= 50}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...ids, tag.id]
                        : ids.filter((id) => id !== tag.id);
                      if (onChange) onChange(next);
                      else setLocal(next);
                    }}
                  />
                  <span>
                    {tag.name}
                    {admin && (
                      <small className="muted">
                        {!tag.enabled ? " · 停用" : ""}
                        {!tag.publicVisible ? " · 網站隱藏" : ""}
                        {!tag.botVisible ? " · Bot 隱藏" : ""}
                      </small>
                    )}
                  </span>
                </label>
              ))}
            </div>
          ) : null;
        })}
        {!tags.length && <p className="muted">沒有符合的標籤。</p>}
      </div>
    </fieldset>
  );
}
