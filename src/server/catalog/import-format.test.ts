import { describe, expect, it } from "vitest";
import {
  decodeImportBytes,
  importDecimal,
  normalizeImportRow,
  parseCsv,
  resolveImportTerm,
} from "./import-format";

describe("versioned import contract", () => {
  it("distinguishes unknown prices from zero and rejects non-decimal or excessive precision", () => {
    expect(importDecimal("", "priceMin")).toBeNull();
    expect(importDecimal(undefined, "priceMin")).toBeNull();
    expect(importDecimal("0", "priceMin")).toBe(0);
    expect(importDecimal("12.50", "priceMin")).toBe(12.5);
    for (const value of ["0x10", "1e2", "-1", "1.001", "Infinity", "NaN"])
      expect(() => importDecimal(value, "priceMin")).toThrow();
  });
  it("decodes UTF-8 BOM before a quoted first header and rejects malformed encoding", () => {
    expect(
      parseCsv(
        decodeImportBytes(
          new TextEncoder().encode('\uFEFF"name",slug\r"中文",example'),
        ),
      ),
    ).toEqual([{ name: "中文", slug: "example" }]);
    expect(() => decodeImportBytes(new Uint8Array([0xff]))).toThrow("UTF-8");
  });
  it("requires an explicit extended version and rejects competing representations", () => {
    expect(() =>
      normalizeImportRow({ name: "A", categorySlug: "local" }),
    ).toThrow("formatVersion");
    expect(() =>
      normalizeImportRow({
        name: "A",
        formatVersion: "2",
        linksJson: "[]",
        website: "https://example.test",
      }),
    ).toThrow("cannot be combined");
    expect(() =>
      normalizeImportRow({ name: "A", category: "local", categoryId: "1" }),
    ).toThrow("conflicts");
  });
  it("retains same-type links, exact URL paths, aliases and decimal strings", () => {
    const links = [
      { type: "website", label: "A", url: "https://example.test/Case#one" },
      { type: "website", label: "B", url: "https://example.test/Case#two" },
    ];
    const row = normalizeImportRow({
      name: "A",
      formatVersion: "2",
      linksJson: JSON.stringify(links),
      aliasesJson: '["a|b"]',
      priceMin: "0",
      priceMax: "1.25",
    });
    expect(JSON.parse(row.links)).toEqual(links);
    expect(row).toMatchObject({
      aliases: '["a|b"]',
      priceMin: "0",
      priceMax: "1.25",
    });
  });
  it("resolves exact slugs, hierarchy paths and aliases without choosing ambiguous or disabled terms", () => {
    const choices = [
      {
        id: 1,
        slug: "north",
        name: "中心",
        enabled: true,
        aliases: ["共用", "別名"],
        path: "北 / 中心",
      },
      {
        id: 2,
        slug: "south",
        name: "中心",
        enabled: true,
        aliases: ["共用"],
        path: "南 / 中心",
      },
      { id: 3, slug: "off", name: "停用", enabled: false },
    ];
    expect(resolveImportTerm("中心", choices)).toMatchObject({
      state: "ambiguous",
      id: null,
    });
    expect(resolveImportTerm("共用", choices)).toMatchObject({
      state: "ambiguous",
      id: null,
    });
    expect(resolveImportTerm("別名", choices)).toMatchObject({
      state: "alias",
      id: 1,
    });
    expect(resolveImportTerm("南 / 中心", choices)).toMatchObject({
      state: "exact",
      id: 2,
    });
    expect(resolveImportTerm("off", choices)).toMatchObject({
      state: "disabled",
      id: null,
    });
    expect(resolveImportTerm("missing", choices)).toMatchObject({
      state: "unknown",
      id: null,
    });
  });
});
