import { searchSchema, type SearchState } from "@/schemas/directory";

type Preset = {
  enabled: boolean;
  placement?: string;
  categoryId: number | null;
  areaId: number | null;
  tagIds: number[];
  priceMin: number | string | null;
  priceMax: number | string | null;
  matchMode: string;
};
type Taxonomy = {
  categories: { id: number; enabled: boolean }[];
  areas: { id: number; enabled: boolean }[];
  tags: { id: number; enabled: boolean; filterable: boolean; publicVisible?: boolean; botVisible?: boolean }[];
};
export type PresetResolution =
  | { available: true; search: SearchState }
  | { available: false; reason: string };

export function resolveNavigationPreset(
  preset: Preset,
  taxonomy: Taxonomy,
  audience: "public" | "bot" | "admin" = "public",
): PresetResolution {
  const unavailable = (reason: string): PresetResolution => ({ available: false, reason });
  if (!preset.enabled) return unavailable("導覽已停用，請啟用後再預覽。");
  if (audience !== "admin" && preset.placement && ![audience, "both"].includes(preset.placement)) {
    return unavailable("此導覽未配置於目前介面，請檢查顯示位置。");
  }
  if (preset.categoryId && !taxonomy.categories.some(item => item.id === preset.categoryId && item.enabled)) {
    return unavailable("分類已停用或不存在，請重新指派分類。");
  }
  if (preset.areaId && !taxonomy.areas.some(item => item.id === preset.areaId && item.enabled)) {
    return unavailable("地區已停用或不存在，請重新指派地區。");
  }
  const audiences = audience === "admin"
    ? preset.placement === "both" ? ["public", "bot"] : [preset.placement ?? "public"]
    : [audience];
  for (const id of preset.tagIds) {
    const tag = taxonomy.tags.find(item => item.id === id);
    if (!tag?.enabled || !tag.filterable || audiences.some(target => target === "bot" ? tag.botVisible === false : tag.publicVisible === false)) {
      return unavailable("標籤已停用、隱藏或不可篩選，請調整標籤／顯示位置。");
    }
  }
  const search = searchSchema.safeParse({
    categoryId: preset.categoryId ?? undefined,
    areaId: preset.areaId ?? undefined,
    tagIds: preset.tagIds,
    tagMatchMode: preset.matchMode,
    priceMin: preset.priceMin === null ? null : Number(preset.priceMin),
    priceMax: preset.priceMax === null ? null : Number(preset.priceMax),
  });
  return search.success
    ? { available: true, search: search.data }
    : unavailable("導覽價格或配對條件無效，請重新設定。");
}
