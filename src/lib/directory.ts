import { resolveNavigationPreset } from "./directory-presets";
import { searchSchema, type SearchInput } from "@/schemas/directory";
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
  if (params.has("audience") && params.get("audience") !== "public") throw new Error("Invalid public audience");
  if (params.getAll("tagIds").some(value => value !== "" && value.split(",").some(part => part.trim() === ""))) throw new Error("Invalid tag filter");
  if (params.has("featured") && !["", "true", "false"].includes(params.get("featured")!)) throw new Error("Invalid featured filter");
  for (const key of ["audience", "status", "q", "categoryId", "category", "areaId", "area", "priceMin", "priceMax", "featured", "sort", "page", "pageSize", "preset", "tagMatchMode"]) {
    if (new Set(params.getAll(key)).size > 1) throw new Error("Conflicting search parameters");
  }
  const number = (key: string) => {
    const value = params.get(key)?.trim();
    return value ? Number(value) : undefined;
  };
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
    sort: (params.get("sort") || undefined) as SearchInput["sort"],
    featured: params.get("featured") ? params.get("featured") === "true" : undefined,
    tagMatchMode: (params.get("tagMatchMode") ??
      "and") as SearchInput["tagMatchMode"],
    status: (params.get("status") ?? "all") as SearchInput["status"],
  };
}

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}
export function generateListingSlug(name: string) {
  const latin = normalizeSearchText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (latin || `listing-${Array.from(name).map(c => c.codePointAt(0)!.toString(36)).join("-")}`).slice(0, 150).replace(/-+$/, "");
}
export function orderAreaHierarchy<T extends { id: number; parentId: number | null }>(areas: T[]): (T & { depth: number })[] {
  const result: (T & { depth: number })[] = [];
  const seen = new Set<number>();
  const visit = (area: T, depth: number) => {
    if (seen.has(area.id)) return;
    seen.add(area.id); result.push({ ...area, depth });
    areas.filter(a => a.parentId === area.id).forEach(a => visit(a, depth + 1));
  };
  areas.filter(a => a.parentId === null || !areas.some(p => p.id === a.parentId)).forEach(a => visit(a, 0));
  areas.forEach(a => visit(a, 0));
  return result;
}
export function resolvePreset(preset: { categoryId: number | null; areaId: number | null; tagIds: number[]; priceMin: string | number | null; priceMax: string | number | null; matchMode: string }): SearchInput {
  return { categoryId: preset.categoryId ?? undefined, areaId: preset.areaId ?? undefined, tagIds: preset.tagIds, tagMatchMode: preset.matchMode === "or" ? "or" : "and", priceMin: preset.priceMin === null ? null : Number(preset.priceMin), priceMax: preset.priceMax === null ? null : Number(preset.priceMax), page: 1 };
}
export function searchToParams(input: SearchInput): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (key === "requestedSort") continue;
    if (key === "sort" && input.requestedSort) continue;
    if (value === undefined || value === null || value === "") continue;
    if (key === "tagIds") (value as number[]).forEach(id => params.append(key, String(id)));
    else params.set(key === "query" ? "q" : key, String(value));
  }
  if (input.requestedSort && input.requestedSort !== "auto") params.set("sort", input.requestedSort);
  return params;
}

export const normalizeSearch = (input: SearchInput = {}) => searchSchema.parse(input);

export function resolveSearchParams(params: URLSearchParams, taxonomy: {
  categories: { id: number; slug: string; enabled: boolean }[];
  areas: { id: number; slug: string; enabled: boolean }[];
  tags: { id: number; slug: string; enabled: boolean; filterable: boolean }[];
  navigation: (Parameters<typeof resolvePreset>[0] & { id: number; enabled: boolean; available?: boolean })[];
}) {
  const raw = searchFromParams(params);
  if (raw.status !== "all") throw new Error("Invalid public status filter");
  const fail = () => { throw new Error("所選篩選條件已停用或不存在，請重新選擇。"); };
  if (params.has("category")) {
    const id = taxonomy.categories.find(c => c.slug === params.get("category") && c.enabled)?.id ?? fail();
    if (raw.categoryId !== undefined && raw.categoryId !== id) fail();
    raw.categoryId = id;
  }
  if (params.has("area")) {
    const id = taxonomy.areas.find(a => a.slug === params.get("area") && a.enabled)?.id ?? fail();
    if (raw.areaId !== undefined && raw.areaId !== id) fail();
    raw.areaId = id;
  }
  if (params.has("tags")) {
    const ids = params.getAll("tags").flatMap(v => v.split(",")).map(slug => taxonomy.tags.find(t => t.slug === slug && t.enabled && t.filterable)?.id ?? fail());
    if (params.has("tagIds") && (ids.some(id => !raw.tagIds?.includes(id)) || raw.tagIds?.some(id => !ids.includes(id)))) fail();
    raw.tagIds = ids;
  }
  if (params.has("preset")) {
    const preset = taxonomy.navigation.find(p => p.id === Number(params.get("preset")) && p.enabled && p.available !== false) ?? fail();
    const explicit = ["q", "category", "categoryId", "area", "areaId", "tags", "tagIds", "priceMin", "priceMax", "featured", "tagMatchMode"].some(k => params.getAll(k).some(value => value.trim() !== ""));
    if (!explicit) {
      const resolved = resolveNavigationPreset(preset, taxonomy);
      if (!resolved.available) fail();
      else Object.assign(raw, resolved.search, { page: raw.page, sort: raw.sort, requestedSort: raw.sort ?? "auto" });
    }
  }
  const input = normalizeSearch(raw);
  if (input.categoryId && !taxonomy.categories.some(c => c.id === input.categoryId && c.enabled)) fail();
  if (input.areaId && !taxonomy.areas.some(a => a.id === input.areaId && a.enabled)) fail();
  if (input.tagIds.some(id => !taxonomy.tags.some(t => t.id === id && t.enabled && t.filterable))) fail();
  return input;
}
