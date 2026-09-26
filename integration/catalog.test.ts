import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { listings, botSessions, botUpdates } from "@/db/schema/directory";
import { users } from "@/db/schema/users";
import {
  CatalogSearchService as catalog,
  saveListing,
  saveTaxonomy,
  deleteListing,
  deleteTaxonomy,
  getTaxonomy,
} from "@/server/catalog/service";
import { previewImport, confirmImport } from "@/server/catalog/import";
import { handleCatalogUpdate } from "@/server/catalog/bot";
import {
  POST as adminPost,
  DELETE as adminDelete,
} from "@/app/api/admin/catalog/route";
import { NextRequest } from "next/server";
import { createSession } from "@/server/services/session-service";
if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test"))
  throw new Error(
    "Integration tests require isolated hker_directory_test database",
  );
let category: number,
  area: number,
  child: number,
  tag: number,
  tag2: number,
  hidden: number;
beforeAll(async () => {
  await db.execute(
    sql`truncate directory_listings, directory_categories, directory_areas, directory_tags, directory_tag_groups, directory_navigation_presets, directory_bot_sessions, directory_bot_updates restart identity cascade`,
  );
  category = (
    await saveTaxonomy("categories", { name: "維修服務", slug: "repair" })
  ).id;
  area = (await saveTaxonomy("areas", { name: "九龍", slug: "kowloon" })).id;
  child = (
    await saveTaxonomy("areas", {
      name: "旺角",
      slug: "mong-kok",
      parentId: area,
    })
  ).id;
  tag = (
    await saveTaxonomy("tags", {
      name: "手機",
      slug: "phone",
      aliases: ["手提電話"],
      botFeatured: true,
    })
  ).id;
  tag2 = (await saveTaxonomy("tags", { name: "即日", slug: "same-day" })).id;
  hidden = (
    await saveTaxonomy("tags", {
      name: "內部",
      slug: "internal",
      publicVisible: false,
      botVisible: false,
    })
  ).id;
  await saveListing({
    name: "測試維修店",
    slug: "repair-shop",
    description: "手機維修",
    categoryId: category,
    areaId: child,
    priceMin: 100,
    priceMax: 500,
    enabled: true,
    featured: true,
    tagIds: [tag, tag2, hidden],
    links: [
      { type: "website", label: "Website", url: "https://example.com" },
      { type: "telegram", label: "Telegram", url: "https://t.me/example" },
      {
        type: "website",
        label: "Hidden",
        url: "https://hidden.example.com",
        enabled: false,
      },
    ],
  });
  await saveListing({
    name: "網上社群",
    slug: "online",
    enabled: true,
    tagIds: [tag],
    priceMin: 600,
    priceMax: null,
  });
  await saveListing({
    name: "隱藏店",
    slug: "disabled",
    enabled: false,
    tagIds: [tag, tag2],
  });
});
afterEach(() => vi.restoreAllMocks());
describe("PostgreSQL directory domain", () => {
  it("has one enabled policy for search, details and bot", async () => {
    expect((await catalog.search()).items.map((i) => i.slug)).toEqual([
      "repair-shop",
      "online",
    ]);
    expect(await catalog.detail("disabled")).toBeNull();
    expect(await catalog.detail("disabled", "bot")).toBeNull();
    expect((await catalog.search({}, "admin")).total).toBe(3);
  });
  it("hydrates repeated links, relations and audience-visible tags", async () => {
    const item = await catalog.detail("repair-shop");
    expect(item?.category?.name).toBe("維修服務");
    expect(item?.area?.name).toBe("旺角");
    expect(item?.tags.map((t) => t.slug)).toEqual(["phone", "same-day"]);
    expect(item?.links).toHaveLength(2);
    expect((await catalog.detail("repair-shop", "admin"))?.links).toHaveLength(
      3,
    );
  });
  it("searches Chinese text, category and tag aliases", async () => {
    expect((await catalog.search({ query: "維修" })).total).toBe(1);
    expect((await catalog.search({ query: "手提電話" })).total).toBe(2);
    expect((await catalog.search({ query: "%" })).total).toBe(0);
  });
  it("uses AND by default and supports explicit OR", async () => {
    expect((await catalog.search({ tagIds: [tag, tag2] })).total).toBe(1);
    expect(
      (await catalog.search({ tagIds: [tag, tag2], tagMatchMode: "or" })).total,
    ).toBe(2);
    expect((await catalog.search({ tagIds: [hidden] })).total).toBe(0);
  });
  it("filters category and area descendants", async () => {
    expect(
      (await catalog.search({ categoryId: category, areaId: area })).total,
    ).toBe(1);
    expect((await catalog.search({ areaId: 99999 })).total).toBe(0);
  });
  it("uses price overlap, open bounds and deterministic pagination", async () => {
    expect((await catalog.search({ priceMin: 500, priceMax: 600 })).total).toBe(
      2,
    );
    expect((await catalog.search({ priceMax: 99 })).total).toBe(0);
    expect((await catalog.search({ pageSize: 1, page: 2 })).items[0].slug).toBe(
      "online",
    );
  });
  it("updates relations atomically and removes listing children", async () => {
    const row = await saveListing({
      name: "Temporary",
      slug: "temporary",
      enabled: true,
      tagIds: [tag],
      links: [{ type: "website", label: "a", url: "https://a.example" }],
    });
    await expect(
      saveListing({ name: "Bad", slug: "temporary", tagIds: [999999] }, row.id),
    ).rejects.toThrow();
    expect((await catalog.detail("temporary"))?.name).toBe("Temporary");
    await saveListing(
      { name: "Updated", slug: "temporary", tagIds: [tag2], enabled: false },
      row.id,
    );
    expect(await catalog.detail("temporary")).toBeNull();
    expect((await catalog.detail("temporary", "admin"))?.tags[0].id).toBe(tag2);
    await deleteListing(row.id);
    expect(await catalog.detail("temporary", "admin")).toBeNull();
  });
  it("prevents area cycles and supports taxonomy CRUD", async () => {
    await expect(
      saveTaxonomy(
        "areas",
        { name: "九龍", slug: "kowloon", parentId: child },
        area,
      ),
    ).rejects.toThrow("cycle");
    const temp = await saveTaxonomy("categories", {
      name: "Temp",
      slug: "temp",
    });
    await saveTaxonomy(
      "categories",
      { name: "Changed", slug: "temp", enabled: false },
      temp.id,
    );
    expect((await getTaxonomy()).categories.some((c) => c.id === temp.id)).toBe(
      false,
    );
    await deleteTaxonomy("categories", temp.id);
  });
  it("requires preview and atomically rejects duplicates", async () => {
    const csv = "name,slug,website\nImported,imported,https://import.example";
    const preview = await previewImport(csv);
    expect(preview.valid).toBe(true);
    await expect(confirmImport(csv + "x", preview.digest)).rejects.toThrow();
    expect(await confirmImport(csv, preview.digest)).toEqual({ imported: 1 });
    expect(await catalog.detail("imported")).toBeNull();
    expect((await previewImport(csv)).valid).toBe(false);
    await expect(confirmImport(csv, preview.digest)).rejects.toThrow();
    await deleteListing((await catalog.detail("imported", "admin"))!.id);
  });
  it("does not default database inserts to public", async () => {
    const [row] = await db
      .insert(listings)
      .values({ name: "Direct", slug: "direct" })
      .returning();
    expect(row.enabled).toBe(false);
    await deleteListing(row.id);
  });
  it("rejects non-admin writes and permits admin create/delete", async () => {
    vi.stubEnv("APP_BASE_URL", "http://localhost");
    const [user] = await db
      .insert(users)
      .values({ email: "directory-test-user@example.com", role: "user" })
      .onConflictDoUpdate({ target: users.email, set: { role: "user" } })
      .returning();
    const token = await createSession(user.id);
    const req = (method: string, body: unknown) =>
      new NextRequest("http://localhost/api/admin/catalog", {
        method,
        headers: {
          origin: "http://localhost",
          cookie: `${process.env.AUTH_SESSION_COOKIE_NAME ?? "__Host-hker_session"}=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    expect(
      (
        await adminPost(
          req("POST", {
            kind: "listings",
            data: { name: "Forbidden", slug: "forbidden" },
          }),
        )
      ).status,
    ).toBe(403);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    const res = await adminPost(
      req("POST", {
        kind: "listings",
        data: { name: "Allowed", slug: "allowed" },
      }),
    );
    expect(res.status).toBe(200);
    const row = await res.json();
    expect(
      (await adminDelete(req("DELETE", { kind: "listings", id: row.id })))
        .status,
    ).toBe(200);
    vi.unstubAllEnvs();
  });
  it("generates configured bot buttons, toggles multiple tags and resumes duplicate updates", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json({ ok: true }));
    await handleCatalogUpdate({
      update_id: 100,
      message: { chat: { id: 7 }, from: { id: 7 }, text: "/start" },
    });
    const first = fetcher.mock.calls.map((c) => JSON.parse(String(c[1]?.body)));
    expect(JSON.stringify(first)).toContain("維修服務");
    expect(JSON.stringify(first)).toContain("#手機");
    const [session] = await db
      .select()
      .from(botSessions)
      .where(eq(botSessions.key, "7:7"));
    const nonce = (session.state as { nonce: string }).nonce;
    for (const [i, id] of [tag, tag2].entries())
      await handleCatalogUpdate({
        update_id: 101 + i,
        callback_query: {
          id: `cb${i}`,
          from: { id: 7 },
          message: { chat: { id: 7 } },
          data: `d:${nonce}:tag:${id}`,
        },
      });
    const [selected] = await db
      .select()
      .from(botSessions)
      .where(eq(botSessions.key, "7:7"));
    expect(
      (selected.state as { search: { tagIds: number[] } }).search.tagIds,
    ).toEqual([tag, tag2]);
    await handleCatalogUpdate({
      update_id: 103,
      callback_query: {
        id: "results",
        from: { id: 7 },
        message: { chat: { id: 7 } },
        data: `d:${nonce}:results:0`,
      },
    });
    expect(JSON.stringify(fetcher.mock.calls)).toContain("測試維修店");
    const count = fetcher.mock.calls.length;
    await handleCatalogUpdate({
      update_id: 103,
      callback_query: {
        id: "results",
        from: { id: 7 },
        message: { chat: { id: 7 } },
        data: `d:${nonce}:results:0`,
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(count);
    const [job] = await db
      .select()
      .from(botUpdates)
      .where(eq(botUpdates.id, 103));
    expect(job.nextOperation).toBe(job.operations.length);
    vi.unstubAllEnvs();
  });
  it('resumes a failed bot delivery without repeating acknowledged messages', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ok:true})).mockRejectedValueOnce(new Error('temporary network error')).mockImplementation(async () => Response.json({ok:true}));
    const update = {update_id:200,message:{chat:{id:8},from:{id:8},text:'手提電話'}};
    await expect(handleCatalogUpdate(update)).rejects.toThrow('temporary network error');
    const [job] = await db.select().from(botUpdates).where(eq(botUpdates.id,200));
    expect(job.nextOperation).toBe(1);
    await handleCatalogUpdate(update);
    const bodies = fetcher.mock.calls.map(c => JSON.parse(String(c[1]?.body)));
    expect(bodies.filter(body => body.text?.includes('2 個結果'))).toHaveLength(1);
    vi.unstubAllEnvs();
  });
  it('generates result pagination and rejects expired callback navigation', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ok:true}));
    await db.insert(botSessions).values({key:'9:9',state:{version:1,nonce:'abcdef12',search:{pageSize:1}}});
    await handleCatalogUpdate({update_id:201,callback_query:{id:'page',from:{id:9},message:{chat:{id:9}},data:'d:abcdef12:results:0'}});
    expect(JSON.stringify(fetcher.mock.calls)).toContain('下一頁');
    await handleCatalogUpdate({update_id:202,callback_query:{id:'next',from:{id:9},message:{chat:{id:9}},data:'d:abcdef12:page:2'}});
    expect(JSON.stringify(fetcher.mock.calls)).toContain('網上社群');
    await handleCatalogUpdate({update_id:203,callback_query:{id:'expired',from:{id:9},message:{chat:{id:9}},data:'d:00000000:tag:1'}});
    expect(JSON.stringify(fetcher.mock.calls)).toContain('選單已過期');
    vi.unstubAllEnvs();
  });

  it('stores attributes and bot journals as native JSON objects and arrays', async () => {
    const row = await saveListing({name:'JSON fixture',slug:'json-fixture',attrs:{hours:'10-18'}});
    const types = await db.execute(sql`select jsonb_typeof(attrs) as kind, attrs->>'hours' as hours from directory_listings where id=${row.id}`);
    expect(types[0]).toMatchObject({kind:'object',hours:'10-18'});
    const journals = await db.execute(sql`select jsonb_typeof(operations) as kind from directory_bot_updates limit 1`);
    expect(journals[0].kind).toBe('array');
    const sessions = await db.execute(sql`select jsonb_typeof(state) as kind from directory_bot_sessions limit 1`);
    expect(sessions[0].kind).toBe('object');
    await deleteListing(row.id);
  });

});
