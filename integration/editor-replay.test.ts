import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { saveListingWithReceipt } from "@/server/catalog/listing-write";
import { CatalogSearchService } from "@/server/catalog/service";
describe("editor response-loss receipts", () => {
  it("creates once under concurrent retries and replays a committed edit before revision validation", async () => {
    const requestKey = randomUUID();
    const data = { name: "Fictional replay", slug: `replay-${requestKey}`, enabled: false, links: [{ type: "website", label: "Fictional", url: "https://example.test" }] };
    const [first, second] = await Promise.all([saveListingWithReceipt(data, undefined, 1, requestKey), saveListingWithReceipt(data, undefined, 1, requestKey)]);
    expect(first.id).toBe(second.id);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    await expect(saveListingWithReceipt({ ...data, name: "changed" }, undefined, 1, requestKey)).rejects.toMatchObject({ code: "CONFLICT" });
    const row = (await CatalogSearchService.detail(data.slug, "admin"))!;
    const key = randomUUID();
    const edit = { ...data, revision: row.revision, name: "Edited fictional", links: row.links };
    const saved = await saveListingWithReceipt(edit, row.id, 1, key);
    expect(await saveListingWithReceipt(edit, row.id, 1, key)).toEqual({ ...saved, replayed: true });
    expect((await CatalogSearchService.detail(data.slug, "admin"))?.links[0].id).toBe(row.links[0].id);
  });
});
