"use client";
import { useEffect } from "react";
import { searchFromParams } from "@/lib/directory";
import type { SearchInput } from "@/schemas/directory";
import type {
  CatalogEventReceipt,
  CatalogSearchObservation as SearchObservation,
} from "@/server/catalog/analytics";

const SEARCH_MARKER = "hker:catalog-search-submit";

function destinationHash(value: string) {
  let left = 2166136261;
  let right = 2246822507;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 16777619);
    right = Math.imul(right ^ code, 3266489909);
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

function currentDestination() {
  return `${location.pathname}${location.search}`;
}

export function observeCatalogEvent(
  kind: "search" | "filter" | "preset" | "tag",
  key: string,
  search?: SearchInput,
  receipt?: CatalogEventReceipt,
  observation?: SearchObservation,
) {
  if (
    (!receipt && !observation) ||
    (kind !== "filter" && !key.trim()) ||
    key.length > 200
  )
    return false;
  const request = () =>
    fetch("/api/catalog/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        key,
        search,
        source: "web",
        receipt,
        observation,
      }),
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

export function CatalogSearchObservation({
  kind,
  eventKey,
  search,
  observation,
}: {
  kind: "search" | "filter";
  eventKey: string;
  search: SearchInput;
  observation: SearchObservation | null;
}) {
  useEffect(() => {
    if (!observation) return;
    try {
      const stored = sessionStorage.getItem(SEARCH_MARKER);
      sessionStorage.removeItem(SEARCH_MARKER);
      if (!stored) return;
      const marker = JSON.parse(stored) as { hash?: unknown; at?: unknown };
      if (
        marker.hash !== destinationHash(currentDestination()) ||
        typeof marker.at !== "number" ||
        Date.now() - marker.at > 60_000 ||
        Date.now() < marker.at
      )
        return;
      observeCatalogEvent(kind, eventKey, search, undefined, observation);
    } catch {
      /* Search remains available when browser measurement storage is unavailable. */
    }
  }, [eventKey, kind, observation, search]);
  return null;
}

// Observe browser actions only. Rendering, pagination and back navigation emit nothing.
export function CatalogEvents() {
  useEffect(() => {
    let receipt: CatalogEventReceipt | undefined;
    let receiptRequest: Promise<CatalogEventReceipt | undefined> | undefined;
    let actionQueue = Promise.resolve();
    let stopped = false;
    const refillReceipt = () => {
      if (receipt) return Promise.resolve(receipt);
      if (receiptRequest) return receiptRequest;
      if (stopped) return Promise.resolve(undefined);
      receiptRequest = (async () => {
        try {
          const response = await fetch("/api/catalog/events", {
            cache: "no-store",
            keepalive: true,
          });
          if (!response.ok) return undefined;
          const value = await response.json();
          if (
            value.version === 1 &&
            value.purpose === "catalog-navigation" &&
            value.source === "web" &&
            typeof value.actionId === "string" &&
            typeof value.occurredAt === "string" &&
            typeof value.signature === "string"
          ) {
            receipt = value;
            return value;
          }
        } catch {
          /* Discovery remains available when measurement is unavailable. */
        }
        return undefined;
      })().finally(() => {
        receiptRequest = undefined;
      });
      return receiptRequest;
    };
    const observe = (
      kind: "search" | "filter" | "preset" | "tag",
      key: string,
      search?: SearchInput,
    ) => {
      actionQueue = actionQueue.then(async () => {
        const current = receipt ?? (await refillReceipt());
        if (!current) return;
        if (receipt === current) receipt = undefined;
        observeCatalogEvent(kind, key, search, current);
        if (!stopped) void refillReceipt();
      });
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
        const destination = new URL(event.target.action, location.href);
        destination.search = params.toString();
        try {
          sessionStorage.setItem(
            SEARCH_MARKER,
            JSON.stringify({
              hash: destinationHash(
                `${destination.pathname}${destination.search}`,
              ),
              at: Date.now(),
            }),
          );
        } catch {
          /* Submission continues without measurement when storage is unavailable. */
        }
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
