import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  listings,
  listingSlugAliases,
  categories,
  areas,
  tags,
  tagGroups,
  navigationPresets,
  navigationPresetTags,
} from "@/db/schema/directory";
import { configureCatalogTransaction, validateNavigationPresetForSave } from "./service";
import { AppError } from "@/lib/errors";
import { generateListingSlug } from "@/lib/directory";

const tables = {
  listings,
  categories,
  areas,
  tags,
  groups: tagGroups,
  navigation: navigationPresets,
};
export type AdminKind = keyof typeof tables;

export async function suggestSlug(
  kind: Exclude<AdminKind, "navigation">,
  name: string,
) {
  const table = tables[kind];
  const base = generateListingSlug(name).slice(0, 150).replace(/-+$/, "");
  for (let suffix = 0; suffix < 1000; suffix++) {
    const slug = suffix ? `${base}-${suffix + 1}` : base;
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, slug))
      .limit(1);
    const [reserved] =
      kind === "listings"
        ? await db
            .select({ slug: listingSlugAliases.slug })
            .from(listingSlugAliases)
            .where(eq(listingSlugAliases.slug, slug))
            .limit(1)
        : [];
    if (!existing && !reserved) return { slug };
  }
  throw new AppError("CONFLICT", "未能產生可用網址代稱，請手動輸入");
}

export async function setPublication(
  kind: AdminKind,
  id: number,
  enabled: boolean,
  revision?: number,
) {
  if (kind === "navigation" && enabled) {
    await db.transaction(async tx => {
      await configureCatalogTransaction(tx);
      const [preset] = await tx.select().from(navigationPresets).where(eq(navigationPresets.id, id)).for("update");
      if (!preset) throw new AppError("NOT_FOUND", "找不到項目");
      const relations = await tx.select().from(navigationPresetTags).where(eq(navigationPresetTags.presetId, id));
      await validateNavigationPresetForSave(tx, { ...preset, enabled: true, tagIds: relations.map(row => row.tagId) });
      await tx.update(navigationPresets).set({ enabled }).where(eq(navigationPresets.id, id));
    });
  } else if (kind === "listings") {
    if (!revision) throw new AppError("CONFLICT", "請重新載入最新收錄");
    const [row] = await db
      .update(listings)
      .set({
        enabled,
        revision: sql`${listings.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(listings.id, id), eq(listings.revision, revision)))
      .returning({ id: listings.id });
    if (!row) throw new AppError("CONFLICT", "收錄已更新，請重新載入");
  } else {
    const table = tables[kind];
    const [row] = await db
      .update(table)
      .set({ enabled })
      .where(eq(table.id, id))
      .returning({ id: table.id });
    if (!row) throw new AppError("NOT_FOUND", "找不到項目");
  }
  return { ok: true };
}

// Only swap positions of the submitted visible rows; never renumber unseen records.
export async function reorderVisible(
  kind: "listings" | "navigation",
  entries: { id: number; sortOrder: number; revision?: number }[],
  ids: number[],
) {
  return db.transaction(async (tx) => {
    await configureCatalogTransaction(tx);
    const table = tables[kind];
    const rows = await tx
      .select()
      .from(table)
      .where(inArray(table.id, ids))
      .for("update");
    if (
      rows.length !== ids.length ||
      rows.some((row) => {
        const expected = entries.find((entry) => entry.id === row.id);
        return (
          !expected ||
          expected.sortOrder !== row.sortOrder ||
          ("revision" in row && expected.revision !== row.revision)
        );
      })
    )
      throw new AppError("CONFLICT", "排序內容已更新，請重新載入後再試");
    const positions = rows.map((row) => row.sortOrder).sort((a, b) => a - b);
    for (let i = 1; i < positions.length; i++)
      positions[i] = Math.max(positions[i], positions[i - 1] + 1);
    for (let index = 0; index < ids.length; index++) {
      if (kind === "listings")
        await tx
          .update(listings)
          .set({
            sortOrder: positions[index],
            revision: sql`${listings.revision} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(listings.id, ids[index]));
      else
        await tx
          .update(navigationPresets)
          .set({ sortOrder: positions[index] })
          .where(eq(navigationPresets.id, ids[index]));
    }
    return { ok: true };
  });
}
