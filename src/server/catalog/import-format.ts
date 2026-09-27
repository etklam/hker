import { AppError } from "@/lib/errors";
export const IMPORT_LIMITS = {
  bytes: 500000,
  rows: 200,
  columns: 24,
  fieldBytes: 24000,
} as const;

export function parseCsv(
  text: string,
  columnMap: Record<string, string> = {},
): Record<string, string>[] {
  if (Buffer.byteLength(text, "utf8") > IMPORT_LIMITS.bytes)
    throw new AppError("INVALID_REQUEST", "CSV must be under 500 KB");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed)
        throw new AppError("INVALID_REQUEST", "Unexpected CSV quote");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed)
        throw new AppError(
          "INVALID_REQUEST",
          "Unexpected text after quoted field",
        );
      cell += c;
    }
  }
  if (quoted) throw new AppError("INVALID_REQUEST", "Unclosed CSV quote");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > IMPORT_LIMITS.rows + 1)
    throw new AppError(
      "INVALID_REQUEST",
      "CSV requires a header and 1–200 rows",
    );
  const headers = rows.shift()!.map((h) => {
    const name = h.replace(/^\uFEFF/, "").trim();
    return columnMap[name] ?? name;
  });
  if (
    headers.length > IMPORT_LIMITS.columns ||
    headers.some((header) => Buffer.byteLength(header, "utf8") > 200)
  )
    throw new AppError(
      "INVALID_REQUEST",
      "CSV has too many or oversized columns",
    );
  if (
    new Set(headers).size !== headers.length ||
    (!headers.includes("name") && !headers.includes("slug"))
  )
    throw new AppError(
      "INVALID_REQUEST",
      "Unique headers including name (create) or slug (update) are required",
    );
  const allowed = [
    "name",
    "slug",
    "shortDescription",
    "description",
    "priceMin",
    "priceMax",
    "priceCurrency",
    "categoryId",
    "areaId",
    "tagIds",
    "website",
    "category",
    "area",
    "tags",
    "links",
    "aliases",
    "attrs",
    "formatVersion",
    "categorySlug",
    "areaSlug",
    "tagSlugs",
    "telegram",
    "instagram",
    "linksJson",
    "aliasesJson",
    "attrsJson",
  ];
  if (headers.some((h) => !allowed.includes(h)))
    throw new AppError("INVALID_REQUEST", "Unsupported CSV column");
  return rows.map((r, index) => {
    if (
      r.some(
        (cell) => Buffer.byteLength(cell, "utf8") > IMPORT_LIMITS.fieldBytes,
      ) ||
      r.length !== headers.length
    )
      throw new AppError(
        "INVALID_REQUEST",
        `Row ${index + 2}: column count mismatch or field exceeds 24 KB`,
      );
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
export const normalizeName = (name: string) =>
  name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").trim();
export function normalizeUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return value;
  }
}

export function decodeImportBytes(bytes: Uint8Array): string {
  if (bytes.byteLength > IMPORT_LIMITS.bytes)
    throw new AppError(
      "INVALID_REQUEST",
      "File exceeds 500 KB; split the file before importing",
    );
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AppError("INVALID_REQUEST", "Use a valid UTF-8 file");
  }
}

export function normalizeImportRow(
  row: Record<string, string>,
): Record<string, string> {
  const extended = [
    "categorySlug",
    "areaSlug",
    "tagSlugs",
    "telegram",
    "instagram",
    "linksJson",
    "aliasesJson",
    "attrsJson",
  ].some((key) => Object.hasOwn(row, key));
  if (
    (extended && row.formatVersion !== "2") ||
    (row.formatVersion && row.formatVersion !== "2")
  )
    throw new AppError(
      "INVALID_REQUEST",
      "Extended CSV requires formatVersion=2",
    );
  const result = { ...row };
  for (const [target, source] of [
    ["category", "categorySlug"],
    ["area", "areaSlug"],
    ["tags", "tagSlugs"],
    ["links", "linksJson"],
    ["aliases", "aliasesJson"],
    ["attrs", "attrsJson"],
  ]) {
    if (row[target]?.trim() && row[source]?.trim())
      throw new AppError(
        "INVALID_REQUEST",
        `${target} conflicts with ${source}`,
      );
    if (Object.hasOwn(row, source)) result[target] = row[source];
  }
  for (const [friendly, numeric] of [
    ["category", "categoryId"],
    ["area", "areaId"],
    ["tags", "tagIds"],
  ])
    if (result[friendly]?.trim() && result[numeric]?.trim())
      throw new AppError(
        "INVALID_REQUEST",
        `${friendly} conflicts with ${numeric}`,
      );
  if (
    result.links?.trim() &&
    ["website", "telegram", "instagram"].some((key) => row[key]?.trim())
  )
    throw new AppError(
      "INVALID_REQUEST",
      "linksJson/links cannot be combined with website, telegram or instagram; use one representation",
    );
  if (!result.links?.trim()) {
    result.links = JSON.stringify(
      ["website", "telegram", "instagram"].flatMap((type) =>
        row[type]?.trim() ? [{ type, label: type, url: row[type].trim() }] : [],
      ),
    );
    result.website = "";
  }
  return result;
}

type Choice = {
  id: number;
  slug: string;
  name: string;
  enabled: boolean;
  aliases?: string[];
  path?: string;
};
export function resolveImportTerm(value: string, choices: Choice[]) {
  const term = value.trim();
  const exact = choices.filter((c) => c.slug === term || c.path === term);
  const named = choices.filter(
    (c) => normalizeName(c.name) === normalizeName(term),
  );
  const aliased = choices.filter((c) =>
    c.aliases?.some((alias) => normalizeName(alias) === normalizeName(term)),
  );
  const matches = exact.length ? exact : named.length ? named : aliased;
  const candidates = [...new Map(matches.map((c) => [c.id, c])).values()];
  const state = !term
    ? "invalid"
    : candidates.length > 1
      ? "ambiguous"
      : !candidates.length
        ? "unknown"
        : !candidates[0].enabled
          ? "disabled"
          : !exact.length && !named.length
            ? "alias"
            : "exact";
  return {
    state,
    id: state === "exact" || state === "alias" ? candidates[0].id : null,
    candidates,
  };
}

export type ImportMapping = {
  kind: "category" | "area" | "tag";
  value: string;
  id: number;
};
