import { describe, expect, it, vi } from "vitest";
import { createDatabase, db } from "@/server/db";
import { previewImport, confirmImport } from "@/server/catalog/import";
import { handleCatalogUpdate } from "@/server/catalog/bot";
import { sql } from "drizzle-orm";
if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test")) throw new Error("Use isolated hker_directory_test only");
describe("bounded connection ownership", () => {
  it("finishes bot/import on one connection and reuses it after rollback and timeout", async () => {
    const small = createDatabase(process.env.DATABASE_URL!, { max: 1 });
    const globalRead = vi.spyOn(db, "select").mockImplementation(() => { throw new Error("Global pool re-entry"); });
    const suffix = `single-${Date.now()}`;
    try {
      const csv = `name,slug\nSingle pool,${suffix}`;
      const preview = await previewImport(csv, small.db);
      expect((await confirmImport(csv, preview.digest, { actorId: 1, requestKey: `${suffix}-single-pool` }, small.db)).imported).toBe(1);
      await handleCatalogUpdate({ update_id: 900000001, message: { chat: { id: 900000001 }, from: { id: 900000001 }, text: "/all" } }, small.db);
      await expect(small.db.transaction(async tx => {
        await tx.execute(sql`insert into directory_listings (name, slug) values ('Rollback', ${`${suffix}-rollback`})`);
        await tx.execute(sql`insert into directory_listing_tags (listing_id, tag_id) values (-1, -1)`);
      })).rejects.toThrow();
      expect((await small.db.execute(sql`select id from directory_listings where slug=${`${suffix}-rollback`}`))).toHaveLength(0);
      await expect(small.db.transaction(async tx => {
        await tx.execute(sql`set local statement_timeout = '50ms'`);
        await tx.execute(sql`select pg_sleep(1)`);
      })).rejects.toThrow();
      expect((await small.db.execute(sql`select 1 as alive`))[0].alive).toBe(1);
      const invalid = `name,slug,categoryId\nInvalid,${suffix}-invalid,2147483647`;
      const rejected = await previewImport(invalid, small.db);
      await expect(confirmImport(invalid, rejected.digest, { actorId: 1, requestKey: `${suffix}-invalid-pool` }, small.db)).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await small.db.execute(sql`select id from directory_listings where slug=${`${suffix}-invalid`}`))).toHaveLength(0);
    } finally {
      globalRead.mockRestore();
      await small.close();
    }
  }, 15000);
  it("finishes simultaneous bot and atomic imports with a two-connection pool", async () => {
    const small = createDatabase(process.env.DATABASE_URL!, { max: 2 });
    const globalRead = vi.spyOn(db, "select").mockImplementation(() => { throw new Error("Global pool re-entry"); });
    const started = performance.now();
    const base = 1000000 + Math.floor(Math.random() * 100000000);
    try {
      await Promise.all(Array.from({ length: 6 }, async (_, index) => {
        const csv = `name,slug\nConcurrent ${index},concurrent-pool-${base}-${index}`;
        const preview = await previewImport(csv, small.db);
        return Promise.all([
          confirmImport(csv, preview.digest, { actorId: 1, requestKey: `concurrent-${base}-${index}` }, small.db),
          handleCatalogUpdate({ update_id: base + index, message: { chat: { id: base + index }, from: { id: base + index }, text: "/all" } }, small.db),
        ]);
      }));
      expect(performance.now() - started).toBeLessThan(15000);
    } finally {
      globalRead.mockRestore();
      await small.close();
    }
  }, 20000);
});
