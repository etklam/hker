import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { listings } from "@/db/schema/directory";
import { saveListing } from "@/server/catalog/service";
import {
  reorderVisible,
  setPublication,
  suggestSlug,
} from "@/server/catalog/admin";
const owned: number[] = [];
beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (url.pathname !== "/hker_directory_test")
    throw new Error("Admin integration tests require hker_directory_test");
});
afterAll(async () => {
  if (owned.length)
    await db.delete(listings).where(inArray(listings.id, owned));
});
async function listing(suffix: string, sortOrder: number) {
  const item = await saveListing({
    name: `管理測試 ${suffix}`,
    slug: `admin-integration-${suffix}`,
    sortOrder,
  });
  owned.push(item.id);
  return item;
}
describe("admin mutations", () => {
  it("reorders only submitted rows and rejects stale updates atomically", async () => {
    const first = await listing("first", 0),
      second = await listing("second", 0),
      unseen = await listing("unseen", 50);
    await reorderVisible("listings", [first, second], [second.id, first.id]);
    const changed = await db
      .select()
      .from(listings)
      .where(inArray(listings.id, [first.id, second.id, unseen.id]));
    expect(changed.find((row) => row.id === second.id)?.sortOrder).toBeLessThan(
      changed.find((row) => row.id === first.id)!.sortOrder,
    );
    expect(changed.find((row) => row.id === unseen.id)?.sortOrder).toBe(50);
    await expect(
      reorderVisible("listings", [first, second], [first.id, second.id]),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await db.select().from(listings).where(eq(listings.id, first.id)))[0]
        .sortOrder,
    ).toBe(1);
  });
  it("publication has optimistic concurrency", async () => {
    const row = await listing("publication", 0);
    await setPublication("listings", row.id, true, row.revision);
    await expect(
      setPublication("listings", row.id, false, row.revision),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await db.select().from(listings).where(eq(listings.id, row.id)))[0]
        .enabled,
    ).toBe(true);
  });
  it("suggests collision-free Chinese slugs", async () => {
    const first = await suggestSlug("listings", "中文測試");
    const row = await saveListing({ name: "中文測試", slug: first.slug });
    owned.push(row.id);
    const next = await suggestSlug("listings", "中文測試");
    expect(next.slug).not.toBe(first.slug);
    expect(next.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
  it("does not suggest an old slug reserved by a renamed listing", async () => {
    const old = await listing("reserved", 0);
    await saveListing(
      {
        ...old,
        slug: "admin-integration-renamed",
        revision: old.revision,
        priceMin: null,
        priceMax: null,
      },
      old.id,
    );
    const suggestion = await suggestSlug(
      "listings",
      "admin integration reserved",
    );
    expect(suggestion.slug).toBe("admin-integration-reserved-2");
  });
});
