"use client";
import { linkTypes } from "@/schemas/directory";
export type EditorLink = {
  id?: number;
  type: string;
  label: string;
  url: string;
  sortOrder: number;
  enabled: boolean;
};
export function LinksEditor({
  links,
  onChange,
}: {
  links: EditorLink[];
  onChange: (links: EditorLink[]) => void;
}) {
  const editLink = <K extends keyof EditorLink>(
    index: number,
    key: K,
    value: EditorLink[K],
  ) =>
    onChange(
      links.map((link, i) => (i === index ? { ...link, [key]: value } : link)),
    );
  return (
    <>
      <h3>外部連結</h3>
      {links.map((link, index) => (
        <div className="link-editor" key={index}>
          <div className="form-grid">
            <label>
              類型
              <select
                value={link.type}
                onChange={(e) => editLink(index, "type", e.target.value)}
              >
                {linkTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              按鈕文字
              <input
                required
                value={link.label}
                onChange={(e) => editLink(index, "label", e.target.value)}
              />
            </label>
          </div>
          <label>
            網址
            <input
              required
              value={link.url}
              onChange={(e) => editLink(index, "url", e.target.value)}
              placeholder="https://…"
            />
          </label>
          <div className="form-grid">
            <label>
              排序
              <input
                type="number"
                value={link.sortOrder}
                onChange={(e) =>
                  editLink(index, "sortOrder", Number(e.target.value))
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={link.enabled}
                onChange={(e) => editLink(index, "enabled", e.target.checked)}
              />
              顯示連結
            </label>
          </div>
          <div className="toolbar">
            {[-1, 1].map((direction) => (
              <button
                key={direction}
                type="button"
                className="button"
                disabled={
                  index + direction < 0 || index + direction >= links.length
                }
                onClick={() => {
                  const next = [...links];
                  [next[index], next[index + direction]] = [
                    next[index + direction],
                    next[index],
                  ];
                  onChange(
                    next.map((item, order) => ({
                      ...item,
                      sortOrder: order,
                    })),
                  );
                }}
              >
                {direction < 0 ? "上移連結" : "下移連結"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button danger"
            onClick={() => onChange(links.filter((_, i) => i !== index))}
          >
            移除連結
          </button>
        </div>
      ))}
      <button
        className="button"
        type="button"
        onClick={() =>
          onChange([
            ...links,
            {
              type: "website",
              label: "官方網站",
              url: "",
              sortOrder: links.length,
              enabled: true,
            },
          ])
        }
      >
        新增連結
      </button>
    </>
  );
}
