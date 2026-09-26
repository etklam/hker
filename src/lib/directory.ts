import type { SearchInput } from "@/schemas/directory";
export function formatPrice(value: {
  priceMin: string | number | null;
  priceMax: string | number | null;
  priceCurrency: string;
}) {
  const { priceMin: min, priceMax: max, priceCurrency } = value;
  const prefix = priceCurrency === "HKD" ? "HK$" : `${priceCurrency} `;
  const fmt = (n: string | number) =>
    Number(n).toLocaleString("en-HK", { maximumFractionDigits: 2 });
  if (min === null && max === null) return "";
  if (min === null) return `≤ ${prefix}${fmt(max!)}`;
  if (max === null) return `${prefix}${fmt(min)}+`;
  return `${prefix}${fmt(min)}–${fmt(max)}`;
}
export function searchFromParams(params: URLSearchParams): SearchInput {
  const number = (key: string) =>
    params.get(key) ? Number(params.get(key)) : undefined;
  return {
    query: params.get("q") ?? "",
    categoryId: number("categoryId"),
    areaId: number("areaId"),
    tagIds: params
      .getAll("tagIds")
      .flatMap((v) => v.split(","))
      .filter(Boolean)
      .map(Number),
    priceMin: number("priceMin") ?? null,
    priceMax: number("priceMax") ?? null,
    page: number("page") ?? 1,
    pageSize: number("pageSize") ?? 12,
    sort: (params.get("sort") ?? "manual") as SearchInput["sort"],
    tagMatchMode: (params.get("tagMatchMode") ??
      "and") as SearchInput["tagMatchMode"],
    status: (params.get("status") ?? "all") as SearchInput["status"],
  };
}
