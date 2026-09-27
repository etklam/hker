import { afterEach, describe, expect, it, vi } from "vitest";
import { telegram, TelegramDeliveryError, truncateTelegram } from "./bot-transport";
import { telegramUpdateSchema, parseCallback, parseCatalogBotInput } from "./bot";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("bounded and isolated Telegram transport", () => {
    it("mocks delivery by default even with a token", async () => {
        vi.stubEnv("TELEGRAM_DELIVERY_MODE", "mock");
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "configured-token");
        const fetcher = vi.spyOn(globalThis, "fetch");
        expect(await telegram("sendMessage", { chat_id: 123, text: "hello" })).toEqual({ message_id: 1 });
        expect(fetcher).not.toHaveBeenCalled();
    });
    it("requires a dedicated development test chat", async () => {
        vi.stubEnv("TELEGRAM_DELIVERY_MODE", "live");
        vi.stubEnv("TELEGRAM_TEST_CHAT_ID", "1");
        await expect(telegram("sendMessage", { chat_id: 2 })).rejects.toMatchObject({ retryable: false });
    });
    it("classifies rate limits, permanent rejection and transient network errors", async () => {
        vi.stubEnv("TELEGRAM_DELIVERY_MODE", "live");
        vi.stubEnv("TELEGRAM_TEST_CHAT_ID", "1");
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
        const fetcher = vi.spyOn(globalThis, "fetch");
        fetcher.mockResolvedValueOnce(Response.json({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 15 } }, { status: 429 }));
        await expect(telegram("sendMessage", { chat_id: 1 })).rejects.toMatchObject({ retryable: true, retryAfter: 15, errorCode: 429, httpStatus: 429, classification: "flood_control", description: "Too Many Requests" });
        fetcher.mockResolvedValueOnce(Response.json({ ok: false, error_code: 403 }, { status: 403 }));
        await expect(telegram("sendMessage", { chat_id: 1 })).rejects.toMatchObject({ retryable: false, classification: "forbidden" });
        fetcher.mockRejectedValueOnce(new Error("timeout"));
        await expect(telegram("sendMessage", { chat_id: 1 })).rejects.toBeInstanceOf(TelegramDeliveryError);
    });
    it("parses commands without database state and never prefix-matches reserved words", () => {
        expect(parseCatalogBotInput("ALL")).toEqual({ kind: "all" });
        expect(parseCatalogBotInput("all day")).toEqual({ kind: "query", text: "all day" });
        expect(parseCatalogBotInput("small")).toEqual({ kind: "query", text: "small" });
        expect(parseCatalogBotInput("/pricehistory 1 2")).toEqual({ kind: "unknown-command" });
        expect(parseCatalogBotInput("/help unexpected")).toEqual({ kind: "unknown-command" });
        expect(parseCatalogBotInput("/price * 500")).toEqual({ kind: "price", min: null, max: 500 });
        expect(parseCatalogBotInput("/price 600 500")).toEqual({ kind: "invalid-price" });
        expect(parseCatalogBotInput("/tags@OtherBot", "HKERBot")).toEqual({ kind: "foreign-command" });
    });
    it("rejects invalid renderer payloads before transport", async () => {
        vi.stubEnv("TELEGRAM_DELIVERY_MODE", "live");
        const fetcher = vi.spyOn(globalThis, "fetch");
        await expect(telegram("sendMessage", { chat_id: 1, text: "x".repeat(4097) })).rejects.toMatchObject({ classification: "renderer", retryable: false });
        await expect(telegram("sendMessage", { chat_id: 1, reply_markup: { inline_keyboard: [[{ callback_data: "中".repeat(30) }]] } })).rejects.toMatchObject({ classification: "renderer" });
        expect(fetcher).not.toHaveBeenCalled();
    });
    it("falls back only when an existing navigation message cannot be edited", async () => {
        vi.stubEnv("TELEGRAM_DELIVERY_MODE", "live");
        vi.stubEnv("TELEGRAM_TEST_CHAT_ID", "1");
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
        const fetcher = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(Response.json({ ok: false, error_code: 400, description: "Bad Request: message to edit not found" }, { status: 400 }))
            .mockResolvedValueOnce(Response.json({ ok: true, result: { message_id: 22 } }));
        expect(await telegram("editMessageText", { chat_id: 1, message_id: 11, text: "menu" })).toEqual({ message_id: 22 });
        expect(fetcher.mock.calls[1][0]).toContain("/sendMessage");
        expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ chat_id: 1, text: "menu" });
        fetcher.mockResolvedValueOnce(Response.json({ ok: false, error_code: 400, description: "Bad Request: invalid markup" }, { status: 400 }));
        await expect(telegram("editMessageText", { chat_id: 1, message_id: 22 })).rejects.toMatchObject({ retryable: false });
        expect(fetcher).toHaveBeenCalledTimes(3);
    });
    it("bounds callback bytes and preserves complete Unicode code points", () => {
        expect(telegramUpdateSchema.safeParse({ update_id: 1, callback_query: { id: "a", from: { id: 1 }, data: "中".repeat(30) } }).success).toBe(false);
        expect(parseCallback("d:12345678:tag:12345678901")).toBeNull();
        expect(truncateTelegram("😀中文", 3)).toBe("😀中");
    });
});
