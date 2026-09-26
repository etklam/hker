import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { botSessions, botUpdates } from "@/db/schema/directory";
import { CatalogSearchService, getTaxonomy } from "./service";
import { searchSchema, type SearchState } from "@/schemas/directory";
import { formatPrice } from "@/lib/directory";
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
      data: z.string().max(64).optional(),
      message: z.object({ chat: chatSchema }).optional(),
    })
    .optional(),
});
type Update = z.infer<typeof telegramUpdateSchema>;
type Button = { text: string; callback_data?: string; url?: string };
type State = { version: 1; nonce: string; search: SearchState };
const stateSchema = z.object({
  version: z.literal(1),
  nonce: z.string().regex(/^[a-f0-9]{8}$/),
  search: searchSchema,
});
export function verifyWebhookSecret(
  actual: string | null,
  expected = process.env.TELEGRAM_WEBHOOK_SECRET,
) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function parseCallback(data: string) {
  const match =
    /^d:([a-f0-9]{8}):(home|tags|group|tag|categories|category|areas|area|price|budget|results|page|clear|preset|newest|featured):([0-9]{1,10})$/.exec(
      data,
    );
  return match
    ? { nonce: match[1], action: match[2], id: Number(match[3]) }
    : null;
}
export function toggleTag(ids: number[], id: number) {
  return ids.includes(id)
    ? ids.filter((value) => value !== id)
    : [...ids, id].slice(0, 50);
}
function button(state: State, text: string, action: string, id = 0): Button {
  return { text, callback_data: `d:${state.nonce}:${action}:${id}` };
}
async function telegram(method: string, body: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram ${method} failed`);
}
export async function handleCatalogUpdate(update: Update) {
  const callback = update.callback_query,
    message = update.message;
  const chatId = callback?.message?.chat.id ?? message?.chat.id;
  const userId = callback?.from.id ?? message?.from?.id;
  if (chatId === undefined || userId === undefined) return;
  const key = `${chatId}:${userId}`;
  const operations: { method: string; body: Record<string, unknown> }[] = [];
  const enqueue = async (method: string, body: Record<string, unknown>) => {
    operations.push({ method, body });
  };
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [seen] = await tx
      .select()
      .from(botUpdates)
      .where(eq(botUpdates.id, update.update_id));
    if (seen) return;
    const [stored] = await tx
      .select()
      .from(botSessions)
      .where(eq(botSessions.key, key));
    const persisted = stateSchema.safeParse(stored?.state);
    let state: State = persisted.success
      ? persisted.data
      : {
          version: 1,
          nonce: randomBytes(4).toString("hex"),
          search: searchSchema.parse({ pageSize: 4 }),
        };
    if (stored && Date.now() - stored.updatedAt.getTime() > 24 * 60 * 60 * 1000)
      state = {
        version: 1,
        nonce: randomBytes(4).toString("hex"),
        search: searchSchema.parse({ pageSize: 4 }),
      };
    const taxonomy = await getTaxonomy("bot");
    const send = (text: string, rows: Button[][] = []) =>
      enqueue("sendMessage", {
        chat_id: chatId,
        text,
        reply_markup: { inline_keyboard: rows },
        link_preview_options: { is_disabled: true },
      });
    const controls = () => [
      [
        button(state, "查看結果", "results"),
        button(state, "清除", "clear"),
        button(state, "返回", "home"),
      ],
    ];
    const selections = () =>
      `已選：${[state.search.query && `「${state.search.query}」`, taxonomy.categories.find((c) => c.id === state.search.categoryId)?.name, taxonomy.areas.find((a) => a.id === state.search.areaId)?.name, ...taxonomy.tags.filter((t) => state.search.tagIds.includes(t.id)).map((t) => `#${t.name}`), formatPrice({ ...state.search, priceCurrency: "HKD" })].filter(Boolean).join(" · ") || "全部收錄"}`;
    const home = async () => {
      await send(
        `香港生活目錄\n${selections()}\n選擇分類、標籤，或直接輸入關鍵字。`,
        [
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
            button(state, "標籤", "tags"),
            button(state, "地區", "areas"),
          ],
          [button(state, "價格", "price")],
          ...controls(),
        ],
      );
    };
    const showTags = async (groupId?: number) => {
      const eligible = taxonomy.tags.filter(
        (t) => t.filterable && (groupId === undefined || t.groupId === groupId),
      );
      await send(`${selections()}\n可選多個標籤；結果須符合所有已選標籤。`, [
        ...(groupId === undefined
          ? taxonomy.groups.map((g) => [button(state, g.name, "group", g.id)])
          : []),
        ...eligible
          .slice(0, 60)
          .map((t) => [
            button(
              state,
              `${state.search.tagIds.includes(t.id) ? "✓ " : ""}#${t.name}`,
              "tag",
              t.id,
            ),
          ]),
        ...controls(),
      ]);
    };
    const results = async () => {
      const result = await CatalogSearchService.search(state.search, "bot");
      await send(
        `${selections()}\n${result.total} 個結果 · 第 ${result.page} 頁`,
      );
      for (const item of result.items) {
        const base = process.env.APP_BASE_URL;
        const urls: Button[][] = item.links
          .filter((l) => /^https?:\/\//.test(l.url))
          .slice(0, 6)
          .map((l) => [{ text: l.label, url: l.url }]);
        if (base && /^https:\/\//.test(base))
          urls.unshift([
            {
              text: "詳情",
              url: new URL(`/listing/${item.slug}`, base).toString(),
            },
          ]);
        await send(
          [
            item.name,
            [item.area?.name, item.category?.name].filter(Boolean).join(" · "),
            formatPrice(item),
            item.shortDescription.slice(0, 240),
            item.tags
              .slice(0, 5)
              .map((t) => `#${t.name}`)
              .join(" "),
          ]
            .filter(Boolean)
            .join("\n"),
          urls,
        );
      }
      const pages: Button[] = [];
      if (result.page > 1)
        pages.push(button(state, "上一頁", "page", result.page - 1));
      if (result.page < result.totalPages)
        pages.push(button(state, "下一頁", "page", result.page + 1));
      await send(
        result.total ? "繼續探索" : "未有符合結果，試試減少篩選条件。",
        [...(pages.length ? [pages] : []), ...controls()],
      );
    };
    let invalid = false;
    if (callback) {
      const parsed = parseCallback(callback.data ?? "");
      await enqueue("answerCallbackQuery", {
        callback_query_id: callback.id,
        text:
          !parsed || parsed.nonce !== state.nonce
            ? "選單已過期，請重新 /start"
            : undefined,
      });
      if (!parsed || parsed.nonce !== state.nonce) invalid = true;
      else {
        const { action, id } = parsed;
        if (!["page", "results"].includes(action)) state.search.page = 1;
        if (action === "clear") {
          state.search = searchSchema.parse({ pageSize: 4 });
          await home();
        } else if (action === "home") await home();
        else if (action === "tags") await showTags();
        else if (action === "group") {
          if (taxonomy.groups.some((g) => g.id === id)) await showTags(id);
          else invalid = true;
        } else if (action === "tag") {
          if (taxonomy.tags.some((t) => t.id === id && t.filterable)) {
            state.search.tagIds = toggleTag(state.search.tagIds, id);
            await showTags();
          } else invalid = true;
        } else if (action === "categories")
          await send("選擇分類", [
            ...taxonomy.categories
              .slice(0, 60)
              .map((c) => [button(state, c.name, "category", c.id)]),
            ...controls(),
          ]);
        else if (action === "category") {
          if (taxonomy.categories.some((c) => c.id === id)) {
            state.search.categoryId = id;
            await showTags();
          } else invalid = true;
        } else if (action === "areas")
          await send("選擇地區（包含下層地區）", [
            ...taxonomy.areas
              .slice(0, 60)
              .map((a) => [button(state, a.name, "area", a.id)]),
            ...controls(),
          ]);
        else if (action === "area") {
          if (taxonomy.areas.some((a) => a.id === id)) {
            state.search.areaId = id;
            await home();
          } else invalid = true;
        } else if (action === "price")
          await send(
            "價格範圍（HKD）；亦可輸入 /price 100 500。用 * 表示無上限或下限。",
            [
              [
                button(state, "≤ HK$100", "budget", 100),
                button(state, "≤ HK$500", "budget", 500),
                button(state, "≤ HK$1,000", "budget", 1000),
              ],
              ...controls(),
            ],
          );
        else if (action === "budget") {
          if ([100, 500, 1000].includes(id)) {
            state.search.priceMin = null;
            state.search.priceMax = id;
            await home();
          } else invalid = true;
        } else if (action === "preset") {
          const preset = taxonomy.navigation.find((p) => p.id === id);
          if (preset) {
            state.search = searchSchema.parse({
              pageSize: 4,
              categoryId: preset.categoryId ?? undefined,
              areaId: preset.areaId ?? undefined,
              tagIds: preset.tagIds,
              tagMatchMode: preset.matchMode,
              priceMin:
                preset.priceMin === null ? null : Number(preset.priceMin),
              priceMax:
                preset.priceMax === null ? null : Number(preset.priceMax),
            });
            await results();
          } else invalid = true;
        } else if (action === "newest") {
          state.search.sort = "newest";
          state.search.featured = undefined;
          await results();
        } else if (action === "featured") {
          state.search.featured = true;
          await results();
        } else if (action === "page") {
          if (id >= 1 && id <= 10000) {
            state.search.page = id;
            await results();
          } else invalid = true;
        } else if (action === "results") await results();
      }
    } else if (message?.text) {
      const text = message.text.trim();
      if (/^\/(start|help)(?:@\w+)?(?:\s|$)/i.test(text)) {
        state = {
          version: 1,
          nonce: randomBytes(4).toString("hex"),
          search: searchSchema.parse({ pageSize: 4 }),
        };
        await home();
      } else if (text.startsWith("/price")) {
        const parts = text.split(/\s+/);
        const parsed = searchSchema.safeParse({
          ...state.search,
          priceMin: parts[1] === "*" ? null : Number(parts[1]),
          priceMax: parts[2] === "*" ? null : Number(parts[2]),
          page: 1,
        });
        if (parts.length === 3 && parsed.success) {
          state.search = parsed.data;
          await home();
        } else
          await send(
            "請輸入 /price 100 500，或 /price * 500。價格必須非負，且上限不低於下限。",
          );
      } else if (text.length > 200) await send("搜尋文字請限制於 200 字以内。");
      else {
        state.search.query = text;
        state.search.page = 1;
        await results();
      }
    }
    if (invalid) await send("選單已過期或選項不存在。請輸入 /start 重新開始。");
    await tx
      .insert(botSessions)
      .values({ key, state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: botSessions.key,
        set: { state, updatedAt: new Date() },
      });
    await tx
      .insert(botUpdates)
      .values({ id: update.update_id, operations })
      .onConflictDoNothing();
  });
  // Persist the reply plan before network I/O; retries resume at the last acknowledged operation.
  const [job] = await db
    .update(botUpdates)
    .set({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) })
    .where(
      and(
        eq(botUpdates.id, update.update_id),
        sql`(${botUpdates.lockedUntil} is null or ${botUpdates.lockedUntil} < now())`,
      ),
    )
    .returning();
  if (!job)
    throw new Error("Telegram update is already being delivered; retry later");
  try {
    for (let i = job.nextOperation; i < job.operations.length; i++) {
      const operation = job.operations[i];
      try {
        await telegram(operation.method, operation.body);
      } catch (error) {
        if (operation.method !== "answerCallbackQuery") throw error;
      }
      await db
        .update(botUpdates)
        .set({ nextOperation: i + 1 })
        .where(eq(botUpdates.id, update.update_id));
    }
  } finally {
    await db
      .update(botUpdates)
      .set({ lockedUntil: null })
      .where(eq(botUpdates.id, update.update_id));
  }
}
