import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { csvCell } from "./export";
import { normalizeImportRow, parseCsv } from "./import-format";
describe("portable templates and spreadsheet CSV", () => {
  it.each(["=1+1", " +1", "\t@SUM(A1)", "\r-1", "＝cmd", "\u200b=cmd"])("escapes spreadsheet formula-like text: %s", text => expect(csvCell(text)).toBe(`"'${text}"`));
  it("preserves commas, quotes, newlines and originals for machine mode", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell("=original", false)).toBe('"=original"');
  });
  it.each(["simple", "advanced"])("parses the actual %s downloadable template", kind => {
    const rows = parseCsv(readFileSync(`public/directory-import-${kind}-v2.csv`, "utf8"));
    const row = normalizeImportRow(rows[0]);
    expect(row.formatVersion).toBe("2");
    expect(JSON.parse(row.links)).toHaveLength(kind === "simple" ? 1 : 2);
  });
});
