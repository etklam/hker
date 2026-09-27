import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { botSessions, botUpdates } from "@/db/schema/directory";
import { CatalogSearchService, configureCatalogTransaction, getTaxonomy } from "./service";
import { searchSchema, type SearchState } from "@/schemas/directory";
import { formatPrice } from "@/lib/directory";
import { resolveNavigationPreset } from "@/lib/directory-presets";
import { telegram, truncateTelegram, contentVersion, type TelegramOperation } from "./bot-transport";
import { recordCatalogEvent, type CatalogEvent } from "./analytics";
import { deliverCatalogUpdate } from "./bot-delivery";
const chatSchema = z.object({ id: z.number().int() });
export const telegramUpdateSchema = z.object({
    update_id: z.number().int().nonnegative(),
    message: z
        .object({
        text: z.string().max(4096).optional(),
        chat: chatSchema,
        from: z.object({ id: z.number().int() }).optional(),
    })
        .optional(),
    callback_query: z
        .object({
        id: z.string(),
        from: z.object({ id: z.number().int() }),
        data: z.string().refine((value) => Buffer.byteLength(value, "utf8") <= 64).optional(),
        message: z.object({ chat: chatSchema, message_id: z.number().int().optional() }).optional(),
    })
        .optional(),
});
type Update = z.infer<typeof telegramUpdateSchema>;
type Button = {
    text: string;
    callback_data?: string;
    url?: string;
};
type State = {
    version: 1;
    ownerKey: string;
    nonce: string;
    search: SearchState;
    view: "home" | "help" | "categories" | "tags" | "groups" | "areas" | "navigation" | "results";
    menuPage: number;
    tagGroupId: number | null;
    tagPage: number;
    sortExplicit: boolean;
};
const stateSchema = z.object({
    version: z.literal(1),
    ownerKey: z.string().max(100).default(""),
    nonce: z.string().regex(/^[a-f0-9]{8}$/),
    search: searchSchema,
    view: z.enum(["home", "help", "categories", "tags", "groups", "areas", "navigation", "results"]).default("home"),
    menuPage: z.number().int().min(0).max(10000).default(0),
    tagGroupId: z.number().int().positive().nullable().default(null),
    tagPage: z.number().int().min(0).max(10000).default(0),
    sortExplicit: z.boolean().default(false),
});
export function verifyWebhookSecret(actual: string | null, expected = process.env.TELEGRAM_WEBHOOK_SECRET) {
    if (!actual || !expected)
        return false;
    const a = Buffer.from(actual), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}
export function parseCallback(data: string) {
    if (Buffer.byteLength(data, "utf8") > 64)
        return null;
    const match = /^d:([a-f0-9]{8}):(home|all|alltags|tags|group|tag|categories|category|areas|area|price|budget|results|page|clear|preset|newest|featured|navigation|groups|mode|remove):([0-9]{1,10})$/.exec(data);
    return match
        ? { nonce: match[1], action: match[2], id: Number(match[3]) }
        : null;
}
function initialState(ownerKey: string): State {
    return {
        version: 1,
        ownerKey,
        nonce: randomBytes(4).toString("hex"),
        search: searchSchema.parse({ pageSize: 4 }),
        view: "home",
        menuPage: 0,
        tagGroupId: null,
        tagPage: 0,
        sortExplicit: false,
    };
}
export type CatalogBotInput =
    | { kind: "start" | "help" | "all" | "categories" | "tags" | "latest" }
    | { kind: "price"; min: number | null; max: number | null }
    | { kind: "query"; text: string }
    | { kind: "invalid-price" | "unknown-command" | "foreign-command" };
export function parseCatalogBotInput(value: string, configuredUsername?: string): CatalogBotInput {
    const text = value.trim();
    if (text.toLocaleLowerCase("en") === "all") return { kind: "all" };
    if (!text.startsWith("/")) return { kind: "query", text };
    const match = /^\/([a-z]+)(?:@([a-z0-9_]+))?(?:\s+(.*))?$/i.exec(text);
    if (!match) return { kind: "unknown-command" };
    const configured = configuredUsername?.replace(/^@/, "").toLowerCase();
    if (match[2] && configured && match[2].toLowerCase() !== configured)
        return { kind: "foreign-command" };
    const name = match[1].toLowerCase();
    const args = match[3]?.trim() ?? "";
    if (["start", "help", "all", "categories", "tags", "latest"].includes(name) && !args)
        return { kind: name as "start" | "help" | "all" | "categories" | "tags" | "latest" };
    if (name !== "price") return { kind: "unknown-command" };
    const parts = args.split(/\s+/).filter(Boolean);
    if (parts.length !== 2) return { kind: "invalid-price" };
    const min = parts[0] === "*" ? null : Number(parts[0]);
    const max = parts[1] === "*" ? null : Number(parts[1]);
    if ((min !== null && (!Number.isFinite(min) || min < 0)) ||
        (max !== null && (!Number.isFinite(max) || max < 0)) ||
        (min !== null && max !== null && max < min)) return { kind: "invalid-price" };
    return { kind: "price", min, max };
}
export function toggleTag(ids: number[], id: number) {
    return ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id].slice(0, 50);
}
function button(state: State, text: string, action: string, id = 0): Button {
    return { text: truncateTelegram(text, 60), callback_data: `d:${state.nonce}:${action}:${id}` };
}
export async function acknowledgeCatalogCallback(update: Update) {
    if (update.callback_query) await telegram("answerCallbackQuery", { callback_query_id: update.callback_query.id }, 1000).catch(() => undefined);
}

export async function handleCatalogUpdate(update: Update, database = db, options: { delivery?: "inline" | "deferred"; acknowledge?: boolean } = {}) {
    const callback = update.callback_query, message = update.message;
    const parsedInput = message?.text ? parseCatalogBotInput(message.text, process.env.TELEGRAM_BOT_USERNAME) : undefined;
    const chatId = callback?.message?.chat.id ?? message?.chat.id;
    const userId = callback?.from.id ?? message?.from?.id;
    if (chatId === undefined || userId === undefined)
        return;
    const key = `${chatId}:${userId}`;
    const operations: TelegramOperation[] = [];
    let event: CatalogEvent | undefined;
    const enqueue = async (method: string, body: Record<string, unknown>) => {
        operations.push({ method, body });
    };
    if (options.acknowledge !== false) await acknowledgeCatalogCallback(update);
    await database.transaction(async (tx) => {
        await configureCatalogTransaction(tx);
        await tx.execute(sql `select pg_advisory_xact_lock(hashtext(${key}))`);
        const [seen] = await tx
            .select()
            .from(botUpdates)
            .where(eq(botUpdates.id, update.update_id));
        if (seen)
            return;
        // The transaction's conversation lock makes admission atomic under concurrent updates.
        const [quota] = await tx.select({ count: sql<number>`count(*)::int` }).from(botUpdates)
            .where(sql`${botUpdates.conversationKey} = ${key} and ${botUpdates.createdAt} >= now() - interval '60 seconds'`);
        if (quota.count >= 60) return;

        const [stored] = await tx
            .select()
            .from(botSessions)
            .where(eq(botSessions.key, key));
        const callbackMatchesMessage = !callback || stored?.messageId === null || stored?.messageId === undefined || callback.message?.message_id === stored.messageId;
        const persisted = stateSchema.safeParse(stored?.state);
        let state: State = persisted.success
            ? { ...persisted.data, ownerKey: key }
            : initialState(key);
        const storedSearch = (stored?.state as { search?: { requestedSort?: unknown } } | undefined)?.search;
        if (persisted.success && storedSearch?.requestedSort === undefined && !state.sortExplicit)
            state.search = searchSchema.parse({ ...state.search, requestedSort: "auto" });
        if (stored && Date.now() - stored.updatedAt.getTime() > 24 * 60 * 60 * 1000)
            state = initialState(key);
        state.search.pageSize = Math.min(4, state.search.pageSize);
        const taxonomy = await getTaxonomy("bot", tx);
        const send = (text: string, rows: Button[][] = []) => enqueue("sendMessage", {
            chat_id: chatId,
            text: truncateTelegram(text),
            reply_markup: { inline_keyboard: rows },
            link_preview_options: { is_disabled: true },
        });
        const controls = () => [
            [button(state, "移除條件", "remove"), button(state, state.search.tagMatchMode === "and" ? "標籤：全部符合" : "標籤：任一符合", "mode")],
            [
                button(state, "查看結果", "results"),
                button(state, "清除", "clear"),
                button(state, "返回", "home"),
            ],
        ];
        const selections = () => truncateTelegram(`已選（${state.search.tagMatchMode.toUpperCase()}）：${[state.search.query && `「${state.search.query}」`, taxonomy.categories.find((c) => c.id === state.search.categoryId)?.name, taxonomy.areas.find((a) => a.id === state.search.areaId)?.name, ...taxonomy.tags.filter((t) => state.search.tagIds.includes(t.id)).slice(0, 5).map((t) => `#${truncateTelegram(t.name, 30)}`), state.search.tagIds.length > 5 && `另 ${state.search.tagIds.length - 5} 個標籤`, formatPrice({ ...state.search, priceCurrency: "HKD" })].filter(Boolean).join(" · ") || "全部收錄"}`, 500);
        const home = async () => {
            state.view = "home";
            state.menuPage = 0;
            await send(`香港生活目錄\n${selections()}\n選擇分類、標籤，或直接輸入關鍵字。\n/all 全部 · /categories 分類 · /tags 標籤 · /latest 最新 · /help 說明`, [
                [button(state, "全部收錄", "all")],
                [button(state, "精選", "featured"), button(state, "最新", "newest")],
                ...taxonomy.navigation
                    .slice(0, 16)
                    .map((p) => [button(state, p.label, "preset", p.id)]),
                ...taxonomy.categories
                    .slice(0, 12)
                    .map((c) => [button(state, c.name, "category", c.id)]),
                ...taxonomy.tags
                    .filter((t) => t.botFeatured && t.filterable)
                    .slice(0, 12)
                    .map((t) => [button(state, `#${t.name}`, "tag", t.id)]),
                [
                    button(state, "分類", "categories"),
                    button(state, "標籤", "alltags"),
                    button(state, "地區", "areas"),
                ],
                [button(state, "價格", "price"), button(state, "所有捷徑", "navigation")],
                ...controls(),
            ]);
        };
        const menuPages = (action: string, page: number, count: number): Button[][] => {
            const row = [];
            if (page > 0)
                row.push(button(state, "上一頁", action, page - 1));
            if ((page + 1) * 12 < count)
                row.push(button(state, "下一頁", action, page + 1));
            return row.length ? [row] : [];
        };
        const menu = (title: string, items: {
            id: number;
            name: string;
        }[], select: string, action: "categories" | "groups" | "areas" | "navigation", page = 0) => {
            state.view = action;
            state.menuPage = page;
            return send(title, [
            ...items.slice(page * 12, page * 12 + 12).map((item) => [button(state, item.name, select, item.id)]),
            ...menuPages(action, page, items.length), ...controls(),
            ]);
        };
        const showTags = async (groupId = state.tagGroupId, page = state.tagPage) => {
            state.view = "tags";
            state.tagGroupId = groupId;
            state.tagPage = page;
            const eligible = taxonomy.tags.filter((t) => t.filterable && (groupId === null || t.groupId === groupId));
            await send(`${selections()}\n可選多個標籤；${state.search.tagMatchMode === "and" ? "須符合全部" : "符合任一"}已選標籤。`, [
                ...(groupId === null
                    ? [[button(state, "標籤群組", "groups")]]
                    : []),
                ...eligible
                    .slice(page * 12, page * 12 + 12)
                    .map((t) => [
                    button(state, `${state.search.tagIds.includes(t.id) ? "✓ " : ""}#${t.name}`, "tag", t.id),
                ]),
                ...menuPages("tags", page, eligible.length),
                ...controls(),
            ]);
        };
        const results = async () => {
            state.view = "results";
            const result = await CatalogSearchService.search(state.search, "bot", tx);
            if (event)
                event.zeroResult = result.total === 0;
            const pages: Button[] = [];
            if (result.page > 1)
                pages.push(button(state, "上一頁", "page", result.page - 1));
            if (result.page < result.totalPages)
                pages.push(button(state, "下一頁", "page", result.page + 1));
            const base = process.env.APP_BASE_URL;
            const rows: Button[][] = [];
            const records = result.items.map((item) => {
                if (base && /^https:\/\//.test(base))
                    rows.push([{ text: truncateTelegram(item.name, 50) + " · 詳情", url: new URL(`/listing/${item.slug}`, base).toString() }]);
                else
                    for (const link of item.links.filter((link) => /^https?:\/\//.test(link.url)).slice(0, 2))
                        rows.push([{ text: truncateTelegram(`${item.name} · ${link.label}`, 60), url: link.url }]);
                return [truncateTelegram(item.name, 100), [item.area?.name, item.category?.name].filter(Boolean).map((name) => truncateTelegram(name!, 30)).join(" · "), formatPrice(item), truncateTelegram(item.shortDescription, 160)].filter(Boolean).join("\n");
            });
            await send(`${selections()}\n${result.total} 個結果 · 第 ${result.page} 頁\n\n${records.join("\n\n")}\n${result.total ? "" : "未有符合結果，試試移除部分條件。"}`, [...rows, ...(pages.length ? [pages] : []), ...controls()]);
            operations[operations.length - 1].listingSlugs = result.items.map((item) => item.slug);
            operations[operations.length - 1].listingVersions = Object.fromEntries(result.items.map((item) => [item.slug, contentVersion(item)]));
        };
        const stale = (state.search.categoryId && !taxonomy.categories.some((c) => c.id === state.search.categoryId)) ||
            (state.search.areaId && !taxonomy.areas.some((a) => a.id === state.search.areaId)) ||
            state.search.tagIds.some((id) => !taxonomy.tags.some((t) => t.id === id && t.filterable));
        if (stale) {
            await send("已選條件已停用，請清除條件後重新選擇。", [[button(state, "清除全部", "clear")]]);
        }
        const stateBeforeCallback = callback ? structuredClone(state) : undefined;
        let invalid = Boolean(callback && !callbackMatchesMessage);
        if (!invalid && stale && callback && parseCallback(callback.data ?? "")?.action !== "clear") {
            // Preserve unavailable restrictive state until the user explicitly clears it.
        }
        else if (!invalid && callback) {
            const parsed = parseCallback(callback.data ?? "");
            if (!parsed || parsed.nonce !== state.nonce)
                invalid = true;
            else {
                const { action, id } = parsed;
                if (!["page", "results"].includes(action))
                    state.search.page = 1;
                if (action === "clear") {
                    state = initialState(key);
                    await home();
                }
                else if (action === "all") {
                    state = initialState(key);
                    await results();
                }
                else if (action === "home")
                    await home();
                else if (action === "tags") {
                    if (id <= 10000) await showTags(state.tagGroupId, id);
                    else invalid = true;
                }
                else if (action === "alltags") {
                    if (id === 0) await showTags(null, 0);
                    else invalid = true;
                }
                else if (action === "groups") {
                    if (id <= 10000) await menu("標籤群組", taxonomy.groups, "group", "groups", id);
                    else invalid = true;
                }
                else if (action === "navigation") {
                    if (id <= 10000) await menu("所有捷徑", taxonomy.navigation.map((p) => ({ id: p.id, name: p.label })), "preset", "navigation", id);
                    else invalid = true;
                }
                else if (action === "mode") {
                    state.search.tagMatchMode = state.search.tagMatchMode === "and" ? "or" : "and";
                    await showTags();
                }
                else if (action === "remove") {
                    if (id === 1)
                        state.search.query = "";
                    if (id === 2)
                        state.search.categoryId = undefined;
                    if (id === 3)
                        state.search.areaId = undefined;
                    if (id === 4) {
                        state.search.priceMin = null;
                        state.search.priceMax = null;
                    }
                    if (id === 5)
                        state.search.featured = undefined;
                    await send(selections(), [[button(state, "關鍵字", "remove", 1), button(state, "分類", "remove", 2), button(state, "地區", "remove", 3)], [button(state, "價格", "remove", 4), button(state, "精選", "remove", 5)], [button(state, "逐個移除標籤", "tags")], ...controls()]);
                }
                else if (action === "group") {
                    if (taxonomy.groups.some((g) => g.id === id))
                        await showTags(id, 0);
                    else
                        invalid = true;
                }
                else if (action === "tag") {
                    if (taxonomy.tags.some((t) => t.id === id && t.filterable)) {
                        event = { kind: "tag", key: String(id), source: "bot", actionId: `telegram:${update.update_id}` };
                        state.search.tagIds = toggleTag(state.search.tagIds, id);
                        await showTags(state.tagGroupId, state.tagPage);
                    }
                    else
                        invalid = true;
                }
                else if (action === "categories") {
                    if (id <= 10000) await menu("選擇分類", taxonomy.categories, "category", "categories", id);
                    else invalid = true;
                }
                else if (action === "category") {
                    if (taxonomy.categories.some((c) => c.id === id)) {
                        state.search.categoryId = id;
                        await showTags(null, 0);
                    }
                    else
                        invalid = true;
                }
                else if (action === "areas") {
                    if (id <= 10000) await menu("選擇地區（包含下層地區）", taxonomy.areas.map((a) => ({ ...a, name: `${a.parentId ? (taxonomy.areas.find((p) => p.id === a.parentId)?.name ?? "") + " › " : ""}${a.name}` })), "area", "areas", id);
                    else invalid = true;
                }
                else if (action === "area") {
                    if (taxonomy.areas.some((a) => a.id === id)) {
                        state.search.areaId = id;
                        await home();
                    }
                    else
                        invalid = true;
                }
                else if (action === "price")
                    await send("價格範圍（HKD）；亦可輸入 /price 100 500。用 * 表示無上限或下限。", [
                        [
                            button(state, "≤ HK$100", "budget", 100),
                            button(state, "≤ HK$500", "budget", 500),
                            button(state, "≤ HK$1,000", "budget", 1000),
                        ],
                        ...controls(),
                    ]);
                else if (action === "budget") {
                    if ([100, 500, 1000].includes(id)) {
                        state.search.priceMin = null;
                        state.search.priceMax = id;
                        await home();
                    }
                    else
                        invalid = true;
                }
                else if (action === "preset") {
                    const preset = taxonomy.navigation.find((p) => p.id === id);
                    if (preset) {
                        const resolved = resolveNavigationPreset(preset, taxonomy, "bot");
                        if (resolved.available) {
                            event = { kind: "preset", key: String(id), source: "bot", actionId: `telegram:${update.update_id}` };
                            state.search = searchSchema.parse({ ...resolved.search, pageSize: 4, requestedSort: "auto" });
                            state.sortExplicit = false;
                            await results();
                        }
                        else
                            invalid = true;
                    }
                    else
                        invalid = true;
                }
                else if (action === "newest") {
                    state.search.sort = "newest";
                    state.search.requestedSort = "newest";
                    state.sortExplicit = true;
                    state.search.featured = undefined;
                    await results();
                }
                else if (action === "featured") {
                    state.search.featured = true;
                    await results();
                }
                else if (action === "page") {
                    if (id >= 1 && id <= 10000) {
                        state.search.page = id;
                        await results();
                    }
                    else
                        invalid = true;
                }
                else if (action === "results")
                    await results();
            }
        }
        else if (parsedInput) {
            if (parsedInput.kind === "foreign-command") {
                // Commands addressed to another bot in a group are ignored.
            }
            else if (parsedInput.kind === "start") {
                state = initialState(key);
                await home();
            }
            else if (parsedInput.kind === "help") {
                state.view = "help";
                await send(`可用指令：\n/start 開始\n/help 說明\n/all 全部收錄\n/categories 分類\n/tags 標籤\n/latest 最新收錄\n/price 最低價 最高價（* 表示開放邊界）\n\n${selections()}`, controls());
            }
            else if (parsedInput.kind === "all") {
                state = initialState(key);
                await results();
            }
            else if (parsedInput.kind === "categories")
                await menu("選擇分類", taxonomy.categories, "category", "categories");
            else if (parsedInput.kind === "tags")
                await showTags(null, 0);
            else if (parsedInput.kind === "latest") {
                state = { ...initialState(key), search: searchSchema.parse({ pageSize: 4, requestedSort: "newest" }), sortExplicit: true };
                await results();
            }
            else if (parsedInput.kind === "price") {
                state.search = searchSchema.parse({
                    ...state.search,
                    priceMin: parsedInput.min,
                    priceMax: parsedInput.max,
                    page: 1,
                });
                await home();
            }
            else if (parsedInput.kind === "invalid-price")
                await send("請輸入 /price 100 500，或 /price * 500。價格必須非負，且上限不低於下限。");
            else if (parsedInput.kind === "unknown-command")
                await send("不支援此指令。請輸入 /help 查看可用指令。");
            else if (parsedInput.kind === "query" && parsedInput.text.length > 200)
                await send("搜尋文字請限制於 200 字以内。");
            else if (stale) { /* The explanation above is the response. */ }
            else if (parsedInput.kind === "query") {
                state.search.query = parsedInput.text;
                if (!state.sortExplicit) {
                    state.search.requestedSort = "auto";
                    state.search.sort = "relevance";
                }
                event = { kind: "search", key: parsedInput.text, source: "bot", actionId: `telegram:${update.update_id}` };
                state.search.page = 1;
                await results();
            }
        }
        if (invalid) {
            if (stateBeforeCallback)
                state = stateBeforeCallback;
            await send("選單已過期或選項不存在。請輸入 /start 重新開始。");
        }
        await tx
            .insert(botSessions)
            .values({ key, state, updatedAt: new Date() })
            .onConflictDoUpdate({
            target: botSessions.key,
            set: { state, updatedAt: new Date() },
        });
        for (const operation of operations)
            operation.taxonomyVersion = contentVersion(taxonomy);
        await tx
            .insert(botUpdates)
            .values({ id: update.update_id, conversationKey: key, chatKey: String(chatId), operations })
            .onConflictDoNothing();
    });
    if (event)
        await recordCatalogEvent(event, database);
    if (database === db && options.delivery !== "deferred")
        await deliverCatalogUpdate(update.update_id);
}
