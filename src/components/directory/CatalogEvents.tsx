"use client";
import { useEffect } from "react";
import { searchFromParams } from "@/lib/directory";
import type { SearchInput } from "@/schemas/directory";

type EventReceipt = {
  actionId: string;
  occurredAt: string;
  signature: string;
};

export function observeCatalogEvent(
  kind: "search" | "filter" | "preset" | "tag",
  key: string,
  search?: SearchInput,
  receipt?: EventReceipt,
) {
  if (!receipt || (kind !== "filter" && !key.trim()) || key.length > 200)
    return false;
  const request = () =>
    fetch("/api/catalog/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, key, search, source: "web", receipt }),
    });
  void request()
    .then((response) => {
      if (response.status >= 500) return request();
    })
    .catch(() => {
      void request().catch(() => {
        /* Analytics must never interrupt discovery. */
      });
    });
  return true;
}

// Observe browser actions only. Rendering, pagination and back navigation emit nothing.
export function CatalogEvents() {
  useEffect(() => {
    let receipt: EventReceipt | undefined;
    let fetchingReceipt = false;
    let stopped = false;
    const refillReceipt = async () => {
      if (receipt || fetchingReceipt || stopped) return;
      fetchingReceipt = true;
      try {
        const response = await fetch("/api/catalog/events", { cache: "no-store" });
        if (!response.ok) return;
        const value = await response.json();
        if (
          typeof value.actionId === "string" &&
          typeof value.occurredAt === "string" &&
          typeof value.signature === "string"
        )
          receipt = value;
      } catch {
        /* Discovery remains available when measurement is unavailable. */
      } finally {
        fetchingReceipt = false;
      }
    };
    const observe = (
      kind: "search" | "filter" | "preset" | "tag",
      key: string,
      search?: SearchInput,
    ) => {
      const current = receipt;
      receipt = undefined;
      observeCatalogEvent(kind, key, search, current);
      void refillReceipt();
    };
    void refillReceipt();
    const submit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      if (new URL(event.target.action, location.href).pathname !== "/search")
        return;
      const params = new URLSearchParams();
      new FormData(event.target).forEach((value, key) => {
        if (typeof value === "string") params.append(key, value);
      });
      try {
        const search = searchFromParams(params);
        const hasStructuredCriteria = Boolean(
          search.categoryId ||
            search.areaId ||
            search.tagIds?.length ||
            search.priceMin !== null ||
            search.priceMax !== null ||
            search.featured !== undefined,
        );
        if (!search.query && !hasStructuredCriteria) return;
        observe(
          search.query ? "search" : "filter",
          search.query ? params.get("q") ?? "" : "applied",
          search,
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
        observe(kind, link?.dataset.catalogKey ?? "");
    };
    document.addEventListener("submit", submit);
    document.addEventListener("click", click);
    return () => {
      stopped = true;
      document.removeEventListener("submit", submit);
      document.removeEventListener("click", click);
    };
  }, []);
  return null;
}
