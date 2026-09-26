"use client";
import { useEffect, useRef, useState } from "react";
import type { Taxonomy } from "@/server/catalog/service";
import { linkTypes } from "@/schemas/directory";
export type EditorValue = Record<string, unknown>;
export function Editor({
  kind,
  initial,
  taxonomy,
  onClose,
  onSaved,
}: {
  kind: string;
  initial: EditorValue;
  taxonomy: Taxonomy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState<EditorValue>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const set = (key: string, v: unknown) =>
    setValue((old) => ({ ...old, [key]: v }));
  const close = () => {
    if (!dirty || window.confirm("尚有未儲存的變更。確定放棄？")) onClose();
  };
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const text = (
    key: string,
    label: string,
    multiline = false,
    required = false,
  ) => (
    <label key={key}>
      {label}
      {multiline ? (
        <textarea
          value={String(value[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          required={required}
          value={String(value[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );
  const number = (key: string, label: string, min?: number) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        step={key.startsWith("price") ? "0.01" : "1"}
        value={String(value[key] ?? "")}
        onChange={(e) =>
          set(key, e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
  const check = (key: string, label: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={Boolean(value[key])}
        onChange={(e) => set(key, e.target.checked)}
      />
      {label}
    </label>
  );
  const select = (
    key: string,
    label: string,
    items: { id: number; name: string }[],
  ) => (
    <label>
      {label}
      <select
        value={String(value[key] ?? "")}
        onChange={(e) =>
          set(key, e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">未設定</option>
        {items.map((i) => (
          <option value={i.id} key={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );
  const tagIds = (value.tagIds ?? []) as number[];
  const links = (value.links ?? []) as {
    type: string;
    label: string;
    url: string;
    sortOrder: number;
    enabled: boolean;
  }[];
  const editLink = (index: number, key: string, v: unknown) =>
    set(
      "links",
      links.map((link, i) => (i === index ? { ...link, [key]: v } : link)),
    );
  const attributes = (value.attributes ?? []) as {
    key: string;
    value: string;
  }[];
  const listing = kind === "listings",
    navigation = kind === "navigation";
  return (
    <dialog
      className="editor"
      ref={dialog}
      aria-labelledby="editor-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const data = { ...value };
            if (listing) {
              if (
                new Set(attributes.map((a) => a.key.trim())).size !==
                attributes.length
              )
                throw new Error("屬性名稱不可重複");
              data.attrs = Object.fromEntries(
                attributes.map((a) => [a.key.trim(), a.value]),
              );
              delete data.attributes;
            }
            if (kind === "tags") {
              data.aliases = String(value.aliasesText ?? "")
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean);
              delete data.aliasesText;
            }
            const response = await fetch("/api/admin/catalog", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, id: initial.id, data }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message ?? "儲存失敗");
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "儲存失敗");
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="editor-header">
          <h2 id="editor-title">
            {initial.id ? "編輯" : "新增"}
            {listing ? "收錄" : "項目"}
          </h2>
          <button
            type="button"
            className="button"
            onClick={close}
            aria-label="關閉編輯器"
          >
            關閉
          </button>
        </header>
        <div className="editor-body">
          {text(navigation ? "label" : "name", "名稱", false, true)}
          {!navigation &&
            text("slug", "網址代稱（英文小寫及連字號）", false, true)}
          {listing && (
            <>
              {text("shortDescription", "簡介", true)}
              {text("description", "詳細介紹", true)}
              <h3>分類與標籤</h3>
            </>
          )}
          {(listing || navigation) && (
            <>
              <div className="form-grid">
                {select("categoryId", "分類", taxonomy.categories)}
                {select("areaId", "地區", taxonomy.areas)}
              </div>
              <fieldset>
                <legend>標籤</legend>
                {taxonomy.tags.map((t) => (
                  <label className="check" key={t.id}>
                    <input
                      type="checkbox"
                      checked={tagIds.includes(t.id)}
                      onChange={(e) =>
                        set(
                          "tagIds",
                          e.target.checked
                            ? [...tagIds, t.id]
                            : tagIds.filter((id) => id !== t.id),
                        )
                      }
                    />
                    {t.name}
                  </label>
                ))}
              </fieldset>
              <h3>價格範圍</h3>
              {listing && text("priceCurrency", "貨幣代碼")}
              <div className="form-grid">
                {number("priceMin", "最低價格", 0)}
                {number("priceMax", "最高價格", 0)}
              </div>
              <p className="muted">
                留空代表沒有指定價格；兩者皆填寫時，上限必須不低於下限。
              </p>
            </>
          )}
          {listing && (
            <>
              <h3>外部連結</h3>
              {links.map((link, index) => (
                <div className="link-editor" key={index}>
                  <div className="form-grid">
                    <label>
                      類型
                      <select
                        value={link.type}
                        onChange={(e) =>
                          editLink(index, "type", e.target.value)
                        }
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
                        onChange={(e) =>
                          editLink(index, "label", e.target.value)
                        }
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
                        onChange={(e) =>
                          editLink(index, "enabled", e.target.checked)
                        }
                      />
                      顯示連結
                    </label>
                  </div>
                  <button
                    type="button"
                    className="button danger"
                    onClick={() =>
                      set(
                        "links",
                        links.filter((_, i) => i !== index),
                      )
                    }
                  >
                    移除連結
                  </button>
                </div>
              ))}
              <button
                className="button"
                type="button"
                onClick={() =>
                  set("links", [
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
              <h3>公開資料</h3>
              <p className="muted">所有屬性會公開顯示，請勿填寫內部備註。</p>
              {attributes.map((a, index) => (
                <div className="link-editor" key={index}>
                  <div className="form-grid">
                    <label>
                      屬性名稱
                      <input
                        required
                        value={a.key}
                        onChange={(e) =>
                          set(
                            "attributes",
                            attributes.map((item, i) =>
                              i === index
                                ? { ...item, key: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      內容
                      <input
                        value={a.value}
                        onChange={(e) =>
                          set(
                            "attributes",
                            attributes.map((item, i) =>
                              i === index
                                ? { ...item, value: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() =>
                      set(
                        "attributes",
                        attributes.filter((_, i) => i !== index),
                      )
                    }
                  >
                    移除屬性
                  </button>
                </div>
              ))}
              <button
                className="button"
                type="button"
                onClick={() =>
                  set("attributes", [...attributes, { key: "", value: "" }])
                }
              >
                新增屬性
              </button>
              {check("featured", "精選推薦")}
            </>
          )}
          {kind === "categories" && (
            <>
              {text("description", "說明", true)}
              {text("icon", "圖示名稱（選填）")}
            </>
          )}
          {kind === "areas" &&
            select(
              "parentId",
              "上層地區",
              taxonomy.areas.filter((a) => a.id !== initial.id),
            )}
          {kind === "tags" && (
            <>
              {select("groupId", "標籤群組", taxonomy.groups)}
              {text("aliasesText", "搜尋別名（每行一個）", true)}
              {check("botFeatured", "Bot 精選標籤")}
              {check("filterable", "可用作篩選")}
            </>
          )}
          {(kind === "tags" || kind === "groups") && (
            <>
              {check("publicVisible", "在網站顯示")}
              {check("botVisible", "在 Telegram 顯示")}
            </>
          )}
          {navigation && (
            <>
              <label>
                顯示位置
                <select
                  value={String(value.placement ?? "both")}
                  onChange={(e) => set("placement", e.target.value)}
                >
                  <option value="both">網站及 Telegram</option>
                  <option value="public">網站</option>
                  <option value="bot">Telegram</option>
                </select>
              </label>
              <label>
                標籤配對
                <select
                  value={String(value.matchMode ?? "and")}
                  onChange={(e) => set("matchMode", e.target.value)}
                >
                  <option value="and">符合所有標籤</option>
                  <option value="or">符合任一標籤</option>
                </select>
              </label>
            </>
          )}
          <h3>發佈與排序</h3>
          {check("enabled", listing ? "發佈收錄" : "啟用")}
          {number("sortOrder", "排序（數字小的優先）")}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </div>
        <footer className="editor-footer">
          <span className="muted">
            {dirty ? "有未儲存的變更" : "所有變更需按儲存"}
          </span>
          <button className="button primary" disabled={busy}>
            {busy ? "儲存中…" : "儲存"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
