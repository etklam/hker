const allowed = new Set([
  "q",
  "categoryId",
  "category",
  "areaId",
  "area",
  "tagIds",
  "tags",
  "tagMatchMode",
  "priceMin",
  "priceMax",
  "featured",
  "sort",
  "page",
  "pageSize",
  "preset",
  "status",
]);

export function searchReturnPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 4000 ||
    !value.startsWith("/search") ||
    /[\u0000-\u001f\u007f\\]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://directory.invalid");
    if (
      url.origin !== "https://directory.invalid" ||
      url.pathname !== "/search" ||
      url.hash
    )
      return null;
    for (const [key, entry] of url.searchParams) {
      if (
        !allowed.has(key) ||
        /[\u0000-\u001f\u007f]/.test(entry) ||
        /%0[ad]/i.test(entry)
      )
        return null;
    }
    return `/search${url.search}`;
  } catch {
    return null;
  }
}
