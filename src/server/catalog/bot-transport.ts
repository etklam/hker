import { createHash } from "node:crypto";
export type TelegramOperation = {
    method: string;
    body: Record<string, unknown>;
    taxonomyVersion?: string;
    listingVersions?: Record<string, string>;
    listingSlug?: string;
    listingSlugs?: string[];
};
export type TelegramFailureClass = "flood_control" | "network" | "timeout" | "server" | "forbidden" | "invalid_request" | "expired_callback" | "renderer" | "configuration" | "unexpected";
const safeText = (value: unknown, fallback: string) => String(value ?? fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[redacted]").slice(0, 500);
export class TelegramDeliveryError extends Error {
    constructor(message: string, public retryable: boolean, public retryAfter = 0, public errorCode?: number, public description = message, public httpStatus?: number, public classification: TelegramFailureClass = retryable ? "network" : "invalid_request") {
        super(safeText(message, "Telegram delivery failed"));
        this.description = safeText(description, this.message);
    }
}
export function truncateTelegram(text: string, limit = 3500) {
    return text.slice(0, limit).replace(/[\uD800-\uDBFF]$/, "");
}
function validateTelegramBody(body: Record<string, unknown>) {
    if (typeof body.text === "string" && body.text.length > 4096)
        throw new TelegramDeliveryError("Telegram renderer produced oversized text", false, 0, undefined, "oversized text", undefined, "renderer");
    const keyboard = (body.reply_markup as { inline_keyboard?: { callback_data?: unknown }[][] } | undefined)?.inline_keyboard ?? [];
    for (const row of keyboard) for (const button of row) {
        if (button.callback_data !== undefined && (typeof button.callback_data !== "string" || Buffer.byteLength(button.callback_data, "utf8") < 1 || Buffer.byteLength(button.callback_data, "utf8") > 64))
            throw new TelegramDeliveryError("Telegram renderer produced invalid callback data", false, 0, undefined, "invalid callback data", undefined, "renderer");
    }
}
export async function telegram(method: string, body: Record<string, unknown>, timeoutMs = 15000): Promise<{
    message_id?: number;
}> {
    validateTelegramBody(body);
    const mode = process.env.TELEGRAM_DELIVERY_MODE ?? (process.env.NODE_ENV === "production" ? "" : "mock");
    if (mode === "mock") {
        const mockDelay = Number(process.env.TELEGRAM_MOCK_DELAY_MS ?? 0);
        if (Number.isInteger(mockDelay) && mockDelay > 0 && mockDelay <= 10000)
            await new Promise((resolve) => setTimeout(resolve, mockDelay));
        return { message_id: 1 };
    }
    if (mode !== "live")
        throw new TelegramDeliveryError("Telegram delivery is disabled or misconfigured", false, 0, undefined, "delivery disabled", undefined, "configuration");
    const deployment = process.env.HKER_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "local");
    if (process.env.NODE_ENV !== "production" &&
        (!process.env.TELEGRAM_TEST_CHAT_ID || (body.chat_id !== undefined && String(body.chat_id) !== process.env.TELEGRAM_TEST_CHAT_ID))) {
        throw new TelegramDeliveryError("Live development delivery requires the dedicated test chat", false, 0, undefined, "test chat mismatch", undefined, "configuration");
    }
    if (deployment === "staging" &&
        (!process.env.TELEGRAM_TEST_CHAT_ID || (body.chat_id !== undefined && String(body.chat_id) !== process.env.TELEGRAM_TEST_CHAT_ID))) {
        throw new TelegramDeliveryError("Staging delivery requires the dedicated test chat", false, 0, undefined, "test chat mismatch", undefined, "configuration");
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token)
        throw new TelegramDeliveryError("TELEGRAM_BOT_TOKEN is required", false, 0, undefined, "missing token", undefined, "configuration");
    let response: Response;
    try {
        response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body), signal: AbortSignal.timeout(Math.min(15000, Math.max(1, timeoutMs))),
        });
    }
    catch (error) {
        const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new TelegramDeliveryError(timeout ? "Telegram request timed out" : "Telegram network failure", true, 0, undefined, timeout ? "request timeout" : "network failure", undefined, timeout ? "timeout" : "network");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        const code = Number(result.error_code ?? response.status);
        const description = safeText(result.description, response.statusText || "Telegram request failed");
        if (method === "editMessageText" && code === 400 && description.includes("message is not modified"))
            return {};
        if (method === "editMessageText" && code === 400 && /message to edit not found|message can't be edited/i.test(description)) {
            const replacement = { ...body };
            delete replacement.message_id;
            return telegram("sendMessage", replacement, timeoutMs);
        }
        const classification: TelegramFailureClass = code === 429 ? "flood_control"
            : response.status >= 500 || code >= 500 ? "server"
                : code === 403 ? "forbidden"
                    : method === "answerCallbackQuery" && code === 400 && /query is too old|query id is invalid/i.test(description) ? "expired_callback"
                        : "invalid_request";
        throw new TelegramDeliveryError(`Telegram ${method}: ${code}: ${description}`, ["flood_control", "server"].includes(classification), Math.max(0, Number(result.parameters?.retry_after) || 0), code, description, response.status, classification);
    }
    return result.result ?? {};
}
export function contentVersion(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
