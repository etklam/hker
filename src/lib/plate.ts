// Street-plate helpers.
//
// Hong Kong wayfinding plates carry a place name in a bounded, fixed-width
// field. The field never grows, so the name has to be fitted to it rather than
// the other way round: long names step down a size, very long names wrap.
// Listings with no area are not "missing" a plate — they are online, which the
// outline variant states directly.

const ONLINE_LABEL = "網上";

/** Latin name for the plate's second line, if a curator supplied one. */
const LATIN_KEYS = ["英文名", "name_en", "英文名稱", "English"];

export type Plate = {
  label: string;
  /** Online listings get the outline plate; physical ones get the filled plate. */
  online: boolean;
  /** Fit class: fewer characters can be set larger. */
  fit: "lg" | "md" | "sm";
};

export function areaPlate(area?: { name: string } | null): Plate {
  const name = area?.name?.trim();
  if (!name || /網上|線上|online/i.test(name))
    return { label: ONLINE_LABEL, online: true, fit: "lg" };
  const length = [...name].length;
  return {
    label: name,
    online: false,
    fit: length <= 2 ? "lg" : length <= 3 ? "md" : "sm",
  };
}

/**
 * The Latin line under a listing name. There is no `name_en` column, so this
 * reads the curator-maintained `attrs` map and simply renders nothing when the
 * entry is absent — a half-filled plate is worse than a Chinese-only one.
 */
export function latinName(attrs: Record<string, string> | undefined | null) {
  if (!attrs) return null;
  for (const key of LATIN_KEYS) {
    const value = attrs[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** Attribute keys consumed by the plate, so the detail table does not repeat them. */
export function isPlateAttr(key: string) {
  return LATIN_KEYS.includes(key);
}
