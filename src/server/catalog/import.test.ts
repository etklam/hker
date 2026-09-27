import { describe, it, expect } from "vitest";
import { parseCsv, normalizeName, normalizeUrl } from "./import";
describe("CSV import", () => {
  it("parses escaped quotes and multiline descriptions", () =>
    expect(
      parseCsv('name,slug,description\r\n"A, B",a-b,"line 1\n""quoted"""'),
    ).toEqual([
      { name: "A, B", slug: "a-b", description: 'line 1\n"quoted"' },
    ]));
  it.each([
    "name,name\nx,y",
    'name,slug\n"unclosed,a',
    "name,slug\na,b,c",
    "name,slug,bad\na,b,c",
  ])("rejects malformed CSV", (csv) => expect(() => parseCsv(csv)).toThrow());
  it("bounds UTF-8 bytes per field and the number of columns", () => {
    expect(() => parseCsv(`name\n${"界".repeat(8001)}`)).toThrow();
    const headers = ["name", ...Array.from({ length: 24 }, (_, i) => `x${i}`)];
    expect(() => parseCsv(`${headers.join(",")}\n${headers.map(() => "x").join(",")}`)).toThrow();
  });
  it("normalizes names while preserving meaningful URL fragments", () => {
    expect(normalizeName(" Ａ B ")).toBe("ab");
    expect(normalizeUrl("https://EXAMPLE.com/#x")).toBe("https://example.com/#x");
  });
});
