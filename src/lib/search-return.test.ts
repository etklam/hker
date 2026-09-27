import { describe, expect, it } from "vitest";
import { searchReturnPath } from "./search-return";
describe("bounded search return context", () => {
  it("preserves complete supported criteria", () => {
    const path = "/search?q=%E7%B6%AD%E4%BF%AE&categoryId=1&areaId=2&tagIds=3&tagIds=4&tagMatchMode=or&priceMin=0&priceMax=100&sort=name&page=2";
    expect(searchReturnPath(path)).toBe(path);
  });
  it.each(["https://example.test/search", "//example.test/search", "/search/../admin", "/search?returnTo=/admin", "/search?q=%0d%0a", "/search?q=%250a", "/search#x", "/search/", "/%73earch", "/search?receipt=secret", "/search?q=" + "x".repeat(4000), ["/search"]])("rejects unsafe or unsupported context", value => {
    expect(searchReturnPath(value)).toBeNull();
  });
});
