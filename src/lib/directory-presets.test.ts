import { describe, expect, it } from "vitest";
import { resolveNavigationPreset } from "./directory-presets";
const preset = { enabled: true, placement: "both", categoryId: null, areaId: null, tagIds: [1], priceMin: 0, priceMax: null, matchMode: "or" };
const taxonomy = { categories: [], areas: [], tags: [{ id: 1, enabled: true, filterable: true, publicVisible: true, botVisible: false }] };
describe("shared preset resolution", () => {
  it("enforces every configured placement during admin validation", () => {
    expect(resolveNavigationPreset(preset, taxonomy, "public").available).toBe(true);
    expect(resolveNavigationPreset(preset, taxonomy, "bot").available).toBe(false);
    expect(resolveNavigationPreset(preset, taxonomy, "admin").available).toBe(false);
    expect(resolveNavigationPreset({ ...preset, placement: "public" }, taxonomy, "admin")).toMatchObject({ available: true, search: { priceMin: 0, tagMatchMode: "or", requestedSort: "auto" } });
  });
  it("never drops an unavailable reference into a broad query", () => {
    expect(resolveNavigationPreset({ ...preset, tagIds: [999] }, taxonomy).available).toBe(false);
    expect(resolveNavigationPreset({ ...preset, categoryId: 999 }, taxonomy).available).toBe(false);
    expect(resolveNavigationPreset({ ...preset, enabled: false }, taxonomy).available).toBe(false);
  });
});
