import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { catalogHistory } from "@/db/schema/directoryOperations";
import {
  CatalogSearchService,
  deleteListing,
  saveListing,
} from "@/server/catalog/service";

describe("release candidate destructive mutation boundary", () => {
  it("rejects a stale deletion and records actor/content/children for the reviewed deletion", async () => {
    const created = await saveListing({
      name: "虛構刪除回歸",
      slug: `rc-delete-${Date.now()}`,
      links: [
        {
          type: "website",
          label: "保留歷史",
          url: "https://example.test/delete",
        },
      ],
    });
    const current = (await CatalogSearchService.detail(created.slug, "admin"))!;
    const updated = await saveListing(
      {
        ...current,
        tagIds: current.tags.map((tag) => tag.id),
        description: "另一管理員已更新",
        slug: `${created.slug}-renamed`,
      },
      created.id,
    );
    await expect(
      deleteListing(created.id, created.revision, { actorId: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await CatalogSearchService.detail(created.slug, "admin"),
    ).not.toBeNull();
    await deleteListing(created.id, updated.revision, { actorId: 1 });
    expect(await CatalogSearchService.detail(created.slug, "admin")).toBeNull();
    const history = await db
      .select()
      .from(catalogHistory)
      .where(
        and(
          eq(catalogHistory.entityId, created.id),
          eq(catalogHistory.entity, "listing"),
          eq(catalogHistory.action, "delete"),
        ),
      );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      actorId: 1,
      beforeRevision: updated.revision,
      afterRevision: null,
    });
    expect(history[0].changes).toHaveProperty("links");
    expect(history[0].changes).toHaveProperty("slugAliases.before", [created.slug]);
  });
});
