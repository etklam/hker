import { describe, it, expect } from "vitest";
import { listingSchema, linkSchema, searchSchema } from "./directory";
import { formatPrice, searchFromParams } from "@/lib/directory";
describe("directory validation", () => {
  it("defaults to a draft with optional area and links", () => {
    const item = listingSchema.parse({ name: "網上資源", slug: "online" });
    expect(item.enabled).toBe(false);
    expect(item.areaId).toBeNull();
    expect(item.links).toEqual([]);
  });
  it.each([
    [-1, 2],
    [3, 2],
    [0, -1],
    [Infinity, 10],
  ])("rejects invalid range %s–%s", (priceMin, priceMax) =>
    expect(
      listingSchema.safeParse({ name: "店", slug: "shop", priceMin, priceMax })
        .success,
    ).toBe(false),
  );
  it.each([
    [null, null],
    [0, null],
    [null, 100],
    [100, 500],
    [0, 0],
  ])("accepts range %s–%s", (priceMin, priceMax) =>
    expect(
      listingSchema.safeParse({ name: "店", slug: "shop", priceMin, priceMax })
        .success,
    ).toBe(true),
  );
  it("rejects executable link URLs", () => {
    expect(
      linkSchema.safeParse({
        type: "other",
        label: "bad",
        url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  it("accepts repeated link types", () => {
    expect(
      listingSchema.parse({
        name: "店",
        slug: "shop",
        links: [
          { type: "telegram", label: "群組", url: "https://t.me/test" },
          { type: "telegram", label: "頻道", url: "https://t.me/test2" },
        ],
      }).links,
    ).toHaveLength(2);
  });
  it("bounds pagination and defaults tags to AND", () => {
    expect(searchSchema.parse({}).tagMatchMode).toBe("and");
    expect(searchSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });
  it("reads repeated URL tags and retains numeric zero", () => {
    expect(
      searchFromParams(
        new URLSearchParams("q=維修&tagIds=1&tagIds=2&priceMin=0"),
      ),
    ).toMatchObject({ query: "維修", tagIds: [1, 2], priceMin: 0 });
  });
  it("formats open price bounds", () => {
    expect(
      formatPrice({ priceMin: 0, priceMax: null, priceCurrency: "HKD" }),
    ).toBe("HK$0+");
    expect(
      formatPrice({ priceMin: null, priceMax: 500, priceCurrency: "HKD" }),
    ).toBe("≤ HK$500");
  });
});
