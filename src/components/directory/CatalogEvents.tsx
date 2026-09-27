"use client";
import { useEffect } from "react";
import { searchFromParams } from "@/lib/directory";
import type { SearchInput } from "@/schemas/directory";

export function observeCatalogEvent(
  kind: "search" | "preset" | "tag",
  key: string,
  search?: SearchInput,
) {
  if (!key.trim() || key.length > 200) return;
  void fetch("/api/catalog/events", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      key,
      search,
      source: "web",
      actionId: crypto.randomUUID(),
    }),
  }).catch(() => {
    /* Analytics must never interrupt discovery. */
  });
}

// Observe browser actions only. Rendering, pagination and back navigation emit nothing.
export function CatalogEvents() {
  useEffect(() => {
    const submit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      if (new URL(event.target.action, location.href).pathname !== "/search")
        return;
      const params = new URLSearchParams();
      new FormData(event.target).forEach((value, key) => {
        if (typeof value === "string") params.append(key, value);
      });
      try {
        observeCatalogEvent(
          "search",
          params.get("q") ?? "",
          searchFromParams(params),
        );
      } catch {
        /* Invalid filters are not analytics events. */
      }
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>(
        "a[data-catalog-kind]",
      );
      const kind = link?.dataset.catalogKind;
      if (kind === "preset" || kind === "tag")
        observeCatalogEvent(kind, link?.dataset.catalogKey ?? "");
    };
    document.addEventListener("submit", submit);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("submit", submit);
      document.removeEventListener("click", click);
    };
  }, []);
  return null;
}
