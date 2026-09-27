"use client";
import { useEffect, useRef } from "react";
import type { SearchInput } from "@/schemas/directory";
import { searchToParams } from "@/lib/directory";

function conditions(params: URLSearchParams) {
  const keys = [
    "q",
    "categoryId",
    "areaId",
    "tagIds",
    "tagMatchMode",
    "priceMin",
    "priceMax",
    "featured",
    "sort",
  ];
  return JSON.stringify(
    keys.map((key) => [key, params.getAll(key).filter(Boolean).sort()]),
  );
}
export function SearchForm({
  input,
  children,
}: {
  input: SearchInput;
  children: React.ReactNode;
}) {
  const page = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const serialized = searchToParams(input).toString();
  useEffect(() => {
    const params = new URLSearchParams(serialized);
    const syncResolvedValues = () => {
      // History traversal can restore native field values after React commits.
      // The resolved URL is authoritative whenever a page is restored.
      for (const name of [
        "q",
        "categoryId",
        "areaId",
        "tagMatchMode",
        "featured",
        "priceMin",
        "priceMax",
        "sort",
        "page",
      ]) {
        const field = form.current?.elements.namedItem(name);
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement
        ) {
          field.value = params.get(name) ?? "";
        }
      }
    };
    let restoreTask: ReturnType<typeof setTimeout> | undefined;
    const restore = () => {
      clearTimeout(restoreTask);
      // Run after the browser's native persisted-form restoration step.
      restoreTask = setTimeout(syncResolvedValues, 0);
    };
    syncResolvedValues();
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    return () => {
      clearTimeout(restoreTask);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [serialized]);
  return (
    <form
      ref={form}
      autoComplete="off"
      action="/search"
      onSubmit={(event) => {
        const params = new URLSearchParams();
        new FormData(event.currentTarget).forEach((value, key) => {
          if (typeof value === "string") params.append(key, value);
        });
        if (page.current)
          page.current.value =
            conditions(params) === conditions(searchToParams(input))
              ? String(input.page ?? 1)
              : "1";
      }}
    >
      <input
        ref={page}
        type="hidden"
        name="page"
        defaultValue={input.page ?? 1}
      />
      {children}
    </form>
  );
}
