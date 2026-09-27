import { describe, it, expect } from "vitest";
import { searchSchema } from "@/schemas/directory";
import { generateListingSlug, resolvePreset, resolveSearchParams, searchFromParams, searchToParams, orderAreaHierarchy } from "./directory";
describe("shared directory search", () => {
  it("resolves preset once, validates restrictive filters, and preserves explicit edits", () => {
    const taxonomy = { categories: [], areas: [], tags: [{id: 1, slug: "tag", enabled: true, filterable: true}], navigation: [{id: 1, enabled: true, available: true, categoryId: null, areaId: null, tagIds: [1], priceMin: null, priceMax: null, matchMode: "or"}] };
    expect(resolveSearchParams(new URLSearchParams("preset=1&page=2"), taxonomy)).toMatchObject({tagIds: [1], tagMatchMode: "or", page: 2});
    expect(resolveSearchParams(new URLSearchParams("preset=1&q=new"), taxonomy)).toMatchObject({query: "new", tagIds: []});
    expect(() => resolveSearchParams(new URLSearchParams("tagIds=999"), taxonomy)).toThrow();
    expect(() => resolveSearchParams(new URLSearchParams("featured=garbage"), taxonomy)).toThrow();
    expect(() => resolveSearchParams(new URLSearchParams("audience=admin"), taxonomy)).toThrow();
    expect(() => resolveSearchParams(new URLSearchParams("status=disabled"), taxonomy)).toThrow();
    expect(() => resolveSearchParams(new URLSearchParams("tagIds=,"), taxonomy)).toThrow();
    expect(() => resolveSearchParams(new URLSearchParams("tagIds=1,"), taxonomy)).toThrow();
  });
  it("round-trips OR and zero budgets, explicit sort, featured and pagination", () => {
    const state = { ...resolvePreset({ categoryId: 1, areaId: null, tagIds: [2,3], priceMin: 0, priceMax: null, matchMode: "or" }), query: "中文", featured: true, sort: "newest" as const, requestedSort: "newest" as const, page: 2 };
    expect(searchSchema.parse(searchFromParams(searchToParams(state)))).toMatchObject(state);
  });
  it("normalizes keys and uses relevance only when query is present", () => {
    expect(searchSchema.parse({ query: "  ＡＢＣ   店 " })).toMatchObject({ query: "abc 店", sort: "relevance" });
    expect(searchSchema.parse({}).sort).toBe("manual");
    expect(searchSchema.safeParse({ priceMin: 1.005 }).success).toBe(false);
    expect(searchSchema.parse({ priceMin: 0.01 }).priceMin).toBe(0.01);
    expect(searchSchema.parse({ query: "店", sort: "manual" }).sort).toBe("manual");
    expect(searchSchema.parse(searchFromParams(new URLSearchParams("q=店&sort="))).sort).toBe("relevance");
    expect(searchSchema.parse(searchFromParams(new URLSearchParams("sort="))).sort).toBe("manual");
  });
  it("accepts blank All selection and keeps generated slugs within their bound", () => {
    expect(searchFromParams(new URLSearchParams("featured=" )).featured).toBeUndefined();
    for (const name of ["Long name ".repeat(30), "中文".repeat(100)]) {
      const slug = generateListingSlug(name);
      expect(slug.length).toBeLessThanOrEqual(150);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
  it("places descendants directly below their parent", () => {
    expect(orderAreaHierarchy([{ id: 3, parentId: 1 }, { id: 2, parentId: null }, { id: 1, parentId: null }]).map(a => [a.id, a.depth])).toEqual([[2,0],[1,0],[3,1]]);
  });
});

describe("canonical requested sort and conflicting identifiers", () => {
  it("preserves automatic intent across a query change", () => {
    const initial = searchSchema.parse({ query: "foo" });
    expect(initial).toMatchObject({ requestedSort: "auto", sort: "relevance" });
    const next = searchSchema.parse({ ...initial, query: "" });
    expect(next.sort).toBe("manual");
    expect(searchToParams(initial).has("sort")).toBe(false);
    expect(searchSchema.parse({ ...initial, requestedSort: "newest" }).sort).toBe("newest");
  });
  it("rejects mismatching ID/slug pairs and repeated conflicting scalar values", () => {
    const taxonomy = { categories: [{ id: 1, slug: "one", enabled: true }, { id: 2, slug: "two", enabled: true }], areas: [], tags: [], navigation: [] };
    expect(() => resolveSearchParams(new URLSearchParams("categoryId=1&category=two"), taxonomy)).toThrow();
    expect(resolveSearchParams(new URLSearchParams("categoryId=1&category=one"), taxonomy).categoryId).toBe(1);
    expect(() => searchFromParams(new URLSearchParams("page=1&page=2"))).toThrow();
    expect(searchFromParams(new URLSearchParams("priceMin=%20" )).priceMin).toBeNull();
  });
});
it("rejects conflicting public scope and retains presets with empty optional fields", () => {
  for (const query of ["audience=public&audience=admin", "status=all&status=disabled"]) expect(() => searchFromParams(new URLSearchParams(query))).toThrow();
  const taxonomy = { categories: [], areas: [], tags: [{ id: 1, slug: "one", enabled: true, filterable: true }], navigation: [{ id: 1, enabled: true, available: true, categoryId: null, areaId: null, tagIds: [1], priceMin: null, priceMax: null, matchMode: "and" }] };
  expect(resolveSearchParams(new URLSearchParams("preset=1&q=&priceMin="), taxonomy).tagIds).toEqual([1]);
});
