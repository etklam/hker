import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { createDatabase, db } from "@/server/db";
import { botChatLeases, botRunnerState, botSessions, botUpdates, categories, tags, listings, areas, tagGroups, navigationPresets } from "@/db/schema/directory";
import { handleCatalogUpdate } from "@/server/catalog/bot";
import { cleanupBotState, deliverCatalogUpdate, getBotDeliveryStatus, runBotDelivery } from "@/server/catalog/bot-delivery";
import { setPublication } from "@/server/catalog/admin";
import * as catalogService from "@/server/catalog/service";
import * as transport from "@/server/catalog/bot-transport";
if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test"))
    throw new Error("Requires disposable hker_directory_test");
const small = createDatabase(process.env.DATABASE_URL, { max: 2 });
const execFileAsync = promisify(execFile);
const message = (id: number, text: string, chat = 777) => ({ update_id: id, message: { chat: { id: chat }, from: { id: chat }, text } });
const groupMessage = (id: number, text: string, chat: number, user: number) => ({ update_id: id, message: { chat: { id: chat }, from: { id: user }, text } });
const callback = (id: number, nonce: string, data: string, user = 777, chat = 777, messageId?: number) => ({ update_id: id, callback_query: { id: String(id), from: { id: user }, message: { chat: { id: chat }, message_id: messageId }, data: `d:${nonce}:${data}` } });
async function job(id: number) { return (await db.select().from(botUpdates).where(eq(botUpdates.id, id)))[0]; }
async function session(chat = 777) { return (await db.select().from(botSessions).where(eq(botSessions.key, `${chat}:${chat}`)))[0].state as {
    nonce: string;
    tagGroupId: number | null;
    tagPage: number;
    sortExplicit: boolean;
    search: {
        query: string;
        tagIds: number[];
        categoryId?: number;
        page: number;
        sort: string;
        tagMatchMode: string;
    };
}; }
beforeAll(async () => {
    await db.execute(sql `truncate directory_bot_sessions, directory_bot_updates, directory_bot_chat_leases, directory_bot_runner_state`);
    await db.insert(categories).values(Array.from({ length: 65 }, (_, i) => ({ name: `測試分類${i}`, slug: `bot-category-${i}`, sortOrder: 1000 + i }))).onConflictDoNothing();
    await db.insert(tags).values(Array.from({ length: 85 }, (_, i) => ({ name: `測試標籤${i}${"長".repeat(80)}`, slug: `bot-tag-${i}`, sortOrder: 1000 + i }))).onConflictDoNothing();
    await db.insert(areas).values(Array.from({ length: 85 }, (_, i) => ({ name: `測試地區${i}`, slug: `bot-area-${i}`, sortOrder: 1000 + i }))).onConflictDoNothing();
    await db.insert(navigationPresets).values(Array.from({ length: 20 }, (_, i) => ({ label: `測試捷徑${i}`, sortOrder: 1000 + i }))).onConflictDoNothing();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => small.close());
describe("Telegram durable navigation", () => {
    it("completes concurrent transaction planning on a two-connection pool", async () => {
        await Promise.all(Array.from({ length: 8 }, (_, i) => handleCatalogUpdate(message(8000 + i, "/all", 800 + i), small.db)));
        expect((await job(8007)).status).toBe("pending");
    });
    it("durably queues deferred webhook delivery without invoking a hanging transport", async () => {
        const sender = vi.spyOn(transport, "telegram").mockReturnValue(new Promise(() => {}));
        await handleCatalogUpdate(message(8090, "/start", 809), undefined, { delivery: "deferred", acknowledge: false });
        expect((await job(8090)).status).toBe("pending");
        expect((await job(8090)).operations.length).toBeGreaterThan(0);
        expect(sender).not.toHaveBeenCalled();
    });
    it("atomically rejects excessive conversation planning before taxonomy reads", async () => {
        await db.insert(botUpdates).values(Array.from({ length: 59 }, (_, index) => ({ id: 8500 + index, conversationKey: "850:850", status: "complete", completedAt: new Date(), operations: [] })));
        const taxonomy = vi.spyOn(catalogService, "getTaxonomy");
        await Promise.all([handleCatalogUpdate(message(8560, "/tags", 850), small.db), handleCatalogUpdate(message(8561, "/categories", 850), small.db)]);
        expect(taxonomy).toHaveBeenCalledTimes(1);
        const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(botUpdates).where(eq(botUpdates.conversationKey, "850:850"));
        expect(count.count).toBe(60);
        taxonomy.mockClear();
        await handleCatalogUpdate(message(8562, "/all", 850), small.db);
        expect(taxonomy).not.toHaveBeenCalled();
        expect(await job(8562)).toBeUndefined();
    });
    it("reaches categories, tags, areas and presets beyond featured limits using bounded pages", async () => {
        await handleCatalogUpdate(message(8100, "/start"), small.db);
        const { nonce } = await session();
        await handleCatalogUpdate(callback(8101, nonce, "categories:5"), small.db);
        expect(JSON.stringify((await job(8101)).operations)).toContain("測試分類");
        await handleCatalogUpdate(callback(8102, nonce, "tags:6"), small.db);
        const operations = (await job(8102)).operations;
        expect(JSON.stringify(operations)).toContain("測試標籤");
        await handleCatalogUpdate(callback(8103, nonce, "areas:6"), small.db);
        expect(JSON.stringify((await job(8103)).operations)).toContain("測試地區");
        await handleCatalogUpdate(callback(8104, nonce, "navigation:1"), small.db);
        expect(JSON.stringify((await job(8104)).operations)).toContain("測試捷徑");
        for (const operation of operations) {
            expect(String(operation.body.text).length).toBeLessThan(4096);
            const markup = operation.body.reply_markup as {
                inline_keyboard: {
                    callback_data?: string;
                }[][];
            };
            for (const row of markup.inline_keyboard)
                for (const button of row)
                    if (button.callback_data)
                        expect(Buffer.byteLength(button.callback_data)).toBeLessThanOrEqual(64);
        }
    });
    it("retains tag-group page and truthful OR mode after selecting a tag", async () => {
        const [group] = await db.insert(tagGroups).values({ name: "保留群組", slug: "bot-retained-group" }).onConflictDoUpdate({ target: tagGroups.slug, set: { name: "保留群組" } }).returning();
        await db.insert(tags).values(Array.from({ length: 14 }, (_, i) => ({ name: `群組標籤${i}`, slug: `bot-group-tag-${i}`, groupId: group.id, sortOrder: 3000 + i }))).onConflictDoNothing();
        const [grouped] = await db.select({ id: tags.id }).from(tags).where(eq(tags.groupId, group.id)).limit(1);
        await handleCatalogUpdate(message(8105, "/tags", 786), small.db);
        const state = await session(786);
        await handleCatalogUpdate(callback(8106, state.nonce, `group:${group.id}`, 786, 786), small.db);
        await handleCatalogUpdate(callback(8107, state.nonce, "tags:1", 786, 786), small.db);
        await handleCatalogUpdate(callback(8108, state.nonce, `tag:${grouped.id}`, 786, 786), small.db);
        await handleCatalogUpdate(callback(8109, state.nonce, "mode:0", 786, 786), small.db);
        const persisted = await session(786);
        expect(persisted).toMatchObject({ tagGroupId: group.id, tagPage: 1 });
        expect(persisted.search).toMatchObject({ tagMatchMode: "or" });
        const text = JSON.stringify((await job(8109)).operations);
        expect(text).toContain("符合任一");
        expect(text).toContain("群組標籤");
    });
    it("parses exact commands and retains an explicit newest sort for text", async () => {
        await handleCatalogUpdate(message(8140, "/latest@HKERBot", 814), small.db);
        await handleCatalogUpdate(message(8141, "茶餐廳", 814), small.db);
        expect((await session(814)).search).toMatchObject({ query: "茶餐廳", sort: "newest" });
        await handleCatalogUpdate(message(8142, "/latest", 814), small.db);
        const current = await session(814);
        const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "bot-category-0")).limit(1);
        const [preset] = await db.insert(navigationPresets).values({ label: "有效排序捷徑", categoryId: category.id }).returning({ id: navigationPresets.id });
        await handleCatalogUpdate(callback(8143, current.nonce, `preset:${preset.id}`, 814, 814), small.db);
        expect((await session(814)).sortExplicit).toBe(false);
        await handleCatalogUpdate(message(8144, "港式奶茶", 814), small.db);
        expect((await session(814)).search).toMatchObject({ query: "港式奶茶", sort: "relevance" });
        await handleCatalogUpdate(message(8145, "/prices 1 2", 814), small.db);
        expect(JSON.stringify((await job(8145)).operations)).toContain("不支援此指令");
        expect((await session(814)).search.query).toBe("港式奶茶");
    });
    it("keeps /help state, accepts case-insensitive all and exposes the all-results action", async () => {
        await handleCatalogUpdate(message(8160, "保留搜尋", 816), small.db);
        const before = await session(816);
        await handleCatalogUpdate(message(8161, "/help", 816), small.db);
        expect((await session(816)).search).toEqual(before.search);
        expect(JSON.stringify((await job(8161)).operations)).toContain("/all 全部收錄");
        await handleCatalogUpdate(message(8162, "ALL", 816), small.db);
        expect((await session(816)).search).toMatchObject({ query: "", tagIds: [], page: 1 });
        const allState = await session(816);
        await handleCatalogUpdate(callback(8163, allState.nonce, "all:0", 816, 816), small.db);
        expect(JSON.stringify((await job(8163)).operations)).toContain("全部收錄");
    });
    it("keeps Web and Bot discovery consistent through publish, preset edit, retry and unpublish", async () => {
        const suffix = Date.now().toString(36);
        const tag = await catalogService.saveTaxonomy("tags", {
            name: `跨介面標籤 ${suffix}`,
            slug: `cross-interface-tag-${suffix}`,
            publicVisible: true,
            botVisible: true,
            filterable: true,
        });
        const listing = await catalogService.saveListing({
            name: `跨介面收錄 ${suffix}`,
            slug: `cross-interface-listing-${suffix}`,
            shortDescription: "跨介面發佈與延遲發送驗證",
            tagIds: [tag.id],
            enabled: false,
        });
        const query = { query: listing.name, pageSize: 10 };
        expect((await catalogService.CatalogSearchService.search(query, "public")).total).toBe(0);
        expect((await catalogService.CatalogSearchService.search(query, "bot")).total).toBe(0);

        await setPublication("listings", listing.id, true, listing.revision);
        expect((await catalogService.CatalogSearchService.search(query, "public")).items.map((item) => item.id)).toContain(listing.id);
        expect((await catalogService.CatalogSearchService.search(query, "bot")).items.map((item) => item.id)).toContain(listing.id);
        const preset = await catalogService.saveTaxonomy("navigation", {
            label: `跨介面捷徑 ${suffix}`,
            placement: "bot",
            tagIds: [tag.id],
            matchMode: "and",
            enabled: true,
        });
        await catalogService.saveTaxonomy("navigation", {
            label: `已編輯跨介面捷徑 ${suffix}`,
            placement: "bot",
            tagIds: [tag.id],
            matchMode: "or",
            enabled: true,
        }, preset.id);

        const sender = vi.spyOn(transport, "telegram").mockResolvedValue({ message_id: 817 });
        await handleCatalogUpdate(message(8170, "/start", 817), small.db);
        await deliverCatalogUpdate(8170);
        const state = await session(817);
        await handleCatalogUpdate(callback(8171, state.nonce, `preset:${preset.id}`, 817, 817, 817), small.db);
        expect(JSON.stringify((await job(8171)).operations)).toContain(listing.name);
        expect((await session(817)).search.tagMatchMode).toBe("or");
        sender.mockRejectedValueOnce(new transport.TelegramDeliveryError("network", true, 0, undefined, "network", undefined, "network"));
        await deliverCatalogUpdate(8171, { random: () => 0.5 });
        expect((await job(8171)).status).toBe("retry");

        const [published] = await db.select({ revision: listings.revision }).from(listings).where(eq(listings.id, listing.id));
        await setPublication("listings", listing.id, false, published.revision);
        expect((await catalogService.CatalogSearchService.search(query, "public")).total).toBe(0);
        expect((await catalogService.CatalogSearchService.search(query, "bot")).total).toBe(0);
        await db.update(botUpdates).set({ nextAttemptAt: new Date(0) }).where(eq(botUpdates.id, 8171));
        sender.mockResolvedValueOnce({ message_id: 817 });
        await deliverCatalogUpdate(8171);
        expect(JSON.stringify(sender.mock.calls.at(-1))).not.toContain(listing.name);
        expect(JSON.stringify(sender.mock.calls.at(-1))).toContain("目錄內容已更新");
    });
    it("rejects callbacks from replaced messages without changing session state", async () => {
        await handleCatalogUpdate(message(8150, "/start", 815), small.db);
        const before = await session(815);
        await db.update(botSessions).set({ messageId: 501 }).where(eq(botSessions.key, "815:815"));
        await handleCatalogUpdate(callback(8151, before.nonce, "clear:0", 815, 815, 500), small.db);
        expect(await session(815)).toEqual(before);
        expect(JSON.stringify((await job(8151)).operations)).toContain("選單已過期");
        await handleCatalogUpdate(callback(8152, before.nonce, "mode:0", 815, 815, 501), small.db);
        expect((await session(815)).search.tagMatchMode).toBe("or");
        const paged = await session(815);
        await db.update(botSessions).set({ state: { ...paged, search: { ...paged.search, page: 3 } } }).where(eq(botSessions.key, "815:815"));
        const beforeInvalidOption = await session(815);
        await handleCatalogUpdate(callback(8153, before.nonce, "category:2147483647", 815, 815, 501), small.db);
        expect(await session(815)).toEqual(beforeInvalidOption);
    });
    it("clears all filters only for exact all and protects another user's menu", async () => {
        const { nonce } = await session();
        await handleCatalogUpdate(callback(8110, nonce, "tag:1", 778), small.db);
        expect(JSON.stringify((await job(8110)).operations)).toContain("選單已過期");
        await handleCatalogUpdate(message(8111, "all"), small.db);
        expect((await session()).search).toMatchObject({ query: "", tagIds: [], page: 1 });
        await handleCatalogUpdate(message(8112, "all shops"), small.db);
        expect((await session()).search.query).toBe("all shops");
    });
    it("bounds fifty selected long labels and refuses stale restrictive state", async () => {
        const selected = await db.select({ id: tags.id }).from(tags).limit(50);
        const state = await session();
        await db.update(botSessions).set({ state: { ...state, search: { ...state.search, tagIds: selected.map((t) => t.id) } } }).where(eq(botSessions.key, "777:777"));
        await handleCatalogUpdate(callback(8120, state.nonce, "tags:0"), small.db);
        expect(String((await job(8120)).operations[0].body.text).length).toBeLessThan(4096);
        await db.update(botSessions).set({ state: { ...state, search: { ...state.search, categoryId: 2147483647 } } }).where(eq(botSessions.key, "777:777"));
        await handleCatalogUpdate(callback(8121, state.nonce, "results:0"), small.db);
        expect(JSON.stringify((await job(8121)).operations)).toContain("已停用");
        expect((await session()).search.categoryId).toBe(2147483647);
    });
    it("rechecks unpublished content before recovering an old reply", async () => {
        await db.delete(listings).where(eq(listings.slug, "bot-delivery-visibility"));
        const [listing] = await db.insert(listings).values({ name: "延遲發送測試", slug: "bot-delivery-visibility", enabled: true }).returning();
        await handleCatalogUpdate(message(8190, "延遲發送測試", 819), small.db);
        await db.update(listings).set({ enabled: false }).where(eq(listings.id, listing.id));
        const sender = vi.spyOn(transport, "telegram").mockResolvedValue({ message_id: 42 });
        await deliverCatalogUpdate(8190);
        expect(JSON.stringify(sender.mock.calls)).not.toContain("延遲發送測試");
        expect(JSON.stringify(sender.mock.calls)).toContain("目錄內容已更新");
    });
    it("rechecks publication after a retry is scheduled", async () => {
        const [listing] = await db.insert(listings).values({ name: "重試後停用", slug: "bot-retry-unpublish", enabled: true }).onConflictDoUpdate({ target: listings.slug, set: { enabled: true } }).returning();
        await handleCatalogUpdate(message(8191, "重試後停用", 818), small.db);
        const sender = vi.spyOn(transport, "telegram").mockRejectedValueOnce(new transport.TelegramDeliveryError("network", true, 0, undefined, "network", undefined, "network"));
        await deliverCatalogUpdate(8191, { random: () => 0.5 });
        expect((await job(8191)).status).toBe("retry");
        await db.update(listings).set({ enabled: false }).where(eq(listings.id, listing.id));
        await db.update(botUpdates).set({ nextAttemptAt: new Date(0) }).where(eq(botUpdates.id, 8191));
        sender.mockResolvedValueOnce({ message_id: 43 });
        await deliverCatalogUpdate(8191);
        expect(JSON.stringify(sender.mock.calls.at(-1))).not.toContain("重試後停用");
        expect(JSON.stringify(sender.mock.calls.at(-1))).toContain("目錄內容已更新");
    });
    it("recovers durable jobs, serializes a conversation and deduplicates completion", async () => {
        await handleCatalogUpdate(message(8200, "/help", 820), small.db);
        await handleCatalogUpdate(message(8201, "/help", 820), small.db);
        await db.update(botUpdates).set({ leaseOwner: "crashed-worker", lockedUntil: new Date(0), status: "delivering" }).where(eq(botUpdates.id, 8200));
        await db.update(botSessions).set({ leaseOwner: "crashed-worker", lockedUntil: new Date(0) }).where(eq(botSessions.key, "820:820"));
        const calls: string[] = [];
        const sender = vi.spyOn(transport, "telegram").mockImplementation(async (_method, body) => { calls.push(String(body.text)); await new Promise((resolve) => setTimeout(resolve, 15)); return { message_id: 42 }; });
        await Promise.all([deliverCatalogUpdate(8200), deliverCatalogUpdate(8200), deliverCatalogUpdate(8201)]);
        await runBotDelivery();
        expect((await job(8200)).status).toBe("complete");
        expect((await job(8201)).status).toBe("complete");
        const before = calls.length;
        await deliverCatalogUpdate(8200);
        expect(calls).toHaveLength(before);
        expect(sender.mock.calls.some(([method]) => method === "editMessageText")).toBe(true);
    });
    it("serializes delivery across users sharing one group chat", async () => {
        await handleCatalogUpdate(groupMessage(8230, "/help", -900, 901), small.db);
        await handleCatalogUpdate(groupMessage(8231, "/help", -900, 902), small.db);
        let active = 0, maximum = 0;
        vi.spyOn(transport, "telegram").mockImplementation(async () => {
            active++; maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 20));
            active--;
            return { message_id: 42 };
        });
        await Promise.all([deliverCatalogUpdate(8230), deliverCatalogUpdate(8231)]);
        expect(maximum).toBe(1);
        await deliverCatalogUpdate(8231);
        expect((await job(8230)).status).toBe("complete");
        expect((await job(8231)).status).toBe("complete");
    });
    it("resumes acknowledged operation progress and never clears another owner's lease", async () => {
        await handleCatalogUpdate(message(8250, "/start", 825), small.db);
        await db.update(botUpdates).set({ operations: [{ method: "sendMessage", body: { chat_id: 825, text: "acknowledged" } }, { method: "sendMessage", body: { chat_id: 825, text: "remaining" } }], nextOperation: 1 }).where(eq(botUpdates.id, 8250));
        const sender = vi.spyOn(transport, "telegram").mockImplementation(async () => {
            await db.update(botUpdates).set({ leaseOwner: "replacement", lockedUntil: new Date(Date.now() + 60000) }).where(eq(botUpdates.id, 8250));
            await db.update(botSessions).set({ leaseOwner: "replacement", lockedUntil: new Date(Date.now() + 60000) }).where(eq(botSessions.key, "825:825"));
            return { message_id: 42 };
        });
        await deliverCatalogUpdate(8250);
        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender.mock.calls[0][1].text).toBe("remaining");
        expect((await job(8250)).leaseOwner).toBe("replacement");
        const [stored] = await db.select().from(botSessions).where(eq(botSessions.key, "825:825"));
        expect(stored.leaseOwner).toBe("replacement");
        await db.update(botUpdates).set({ status: "failed", leaseOwner: null, lockedUntil: null, completedAt: new Date() }).where(eq(botUpdates.id, 8250));
    });
    it("persists retry_after and permanent failures without waiting on a connection", async () => {
        await handleCatalogUpdate(message(8300, "/start", 830), small.db);
        const sender = vi.spyOn(transport, "telegram").mockRejectedValueOnce(new transport.TelegramDeliveryError("429", true, 30, 429, "Too Many Requests", 429, "flood_control"));
        await deliverCatalogUpdate(8300);
        const deferred = await job(8300);
        expect(deferred.status).toBe("retry");
        expect(deferred.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 25000);
        expect(deferred.errorClass).toBe("flood_control");
        expect(deferred.leaseOwner).toBeNull();
        await db.update(botUpdates).set({ nextAttemptAt: new Date(0) }).where(eq(botUpdates.id, 8300));
        sender.mockRejectedValueOnce(new transport.TelegramDeliveryError("403", false));
        await deliverCatalogUpdate(8300);
        expect((await job(8300)).status).toBe("failed");
    });
    it("bounds job age, cleanup batches and exposes delivery health without payloads", async () => {
        await handleCatalogUpdate(message(8310, "/help", 831), small.db);
        await db.update(botUpdates).set({ createdAt: new Date(0), status: "delivering", leaseOwner: "active-worker", lockedUntil: new Date(Date.now() + 60000) }).where(eq(botUpdates.id, 8310));
        const sender = vi.spyOn(transport, "telegram");
        await deliverCatalogUpdate(8310, { config: { leaseSeconds: 30, maxAttempts: 2, maxAgeSeconds: 60, baseDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0 } });
        expect((await job(8310))).toMatchObject({ status: "delivering", leaseOwner: "active-worker" });
        await db.update(botUpdates).set({ lockedUntil: new Date(0) }).where(eq(botUpdates.id, 8310));
        await deliverCatalogUpdate(8310, { config: { leaseSeconds: 30, maxAttempts: 2, maxAgeSeconds: 60, baseDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0 } });
        expect((await job(8310))).toMatchObject({ status: "failed", errorClass: "expired" });
        expect(sender).not.toHaveBeenCalled();
        await db.insert(botUpdates).values([
            { id: 8311, conversationKey: "831:831", chatKey: "831", status: "complete", completedAt: new Date(0), operations: [{ method: "sendMessage", body: { text: "old body" } }], nextOperation: 1 },
            { id: 8312, conversationKey: "831:831", chatKey: "831", status: "complete", completedAt: new Date(0), operations: [{ method: "sendMessage", body: { text: "second body" } }], nextOperation: 1 },
        ]);
        const cleaned = await cleanupBotState(1);
        expect(cleaned.bodies).toBeLessThanOrEqual(1);
        expect(cleaned.jobs).toBeLessThanOrEqual(1);
        await runBotDelivery(1, { runnerId: "integration-runner" });
        const status = await getBotDeliveryStatus();
        expect(status.heartbeat?.runnerId).toBe("integration-runner");
        expect(JSON.stringify(status)).not.toContain("old body");
        expect(await db.select().from(botChatLeases).limit(1)).toBeDefined();
        expect(await db.select().from(botRunnerState).limit(1)).toHaveLength(1);
    });
    it("recovers accepted work across real runner process restarts", async () => {
        await execFileAsync("npm", ["run", "ops:build"], { cwd: process.cwd(), timeout: 30000 });
        await handleCatalogUpdate(message(8320, "/help", 832), small.db);
        const first = await execFileAsync(process.execPath, [".ops/bot-runner.cjs", "--limit", "100"], { cwd: process.cwd(), env: { ...process.env, HKER_ENVIRONMENT: "test", APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000", TELEGRAM_DELIVERY_MODE: "mock" }, timeout: 30000 });
        expect(JSON.parse(first.stdout.trim()).completed).toBeGreaterThanOrEqual(1);
        expect((await job(8320)).status).toBe("complete");
        await handleCatalogUpdate(message(8321, "/all", 832), small.db);
        expect((await job(8321)).status).toBe("pending");
        const restarted = await execFileAsync(process.execPath, [".ops/bot-runner.cjs", "--limit", "100"], { cwd: process.cwd(), env: { ...process.env, TELEGRAM_DELIVERY_MODE: "mock" }, timeout: 30000 });
        expect(JSON.parse(restarted.stdout.trim()).completed).toBeGreaterThanOrEqual(1);
        expect((await job(8321)).status).toBe("complete");
        const watching = spawn(process.execPath, [".ops/bot-runner.cjs", "--watch", "--interval-ms", "10000"], { cwd: process.cwd(), env: { ...process.env, TELEGRAM_DELIVERY_MODE: "mock" }, stdio: ["ignore", "pipe", "pipe"] });
        let output = "";
        watching.stdout.on("data", (chunk) => { output += String(chunk); });
        await new Promise((resolve) => setTimeout(resolve, 150));
        watching.kill("SIGTERM");
        const exitCode = await new Promise<number | null>((resolve) => watching.once("exit", resolve));
        expect(exitCode).toBe(0);
        expect(JSON.parse(output.trim())).toMatchObject({ stopped: true });
    }, 70000);
});
