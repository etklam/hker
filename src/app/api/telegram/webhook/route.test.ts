vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/server/catalog/bot-delivery", () => ({ deliverCatalogUpdate: vi.fn() }));
import { after } from "next/server";
import { deliverCatalogUpdate } from "@/server/catalog/bot-delivery";
import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("@/server/catalog/bot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/catalog/bot")>();
  return { ...actual, handleCatalogUpdate: vi.fn(), acknowledgeCatalogCallback: vi.fn().mockResolvedValue(undefined) };
});
import { POST } from "./route";
import {
  handleCatalogUpdate,
  acknowledgeCatalogCallback,
  parseCallback,
  toggleTag,
} from "@/server/catalog/bot";
const request = (body: unknown, secret?: string) =>
  new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {},
    body: JSON.stringify(body),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("directory Telegram webhook", () => {
  it("fails closed without a configured or matching secret", async () => {
    expect((await POST(request({}))).status).toBe(401);
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "secret");
    expect((await POST(request({}, "wrong"))).status).toBe(401);
    expect(handleCatalogUpdate).not.toHaveBeenCalled();
  });
  it("validates updates before handling them", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "secret");
    expect((await POST(request({}, "secret"))).status).toBe(400);
    expect(handleCatalogUpdate).not.toHaveBeenCalled();
  });
  it("accepts authenticated callback updates", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "secret");
    const update = {
      update_id: 1,
      callback_query: {
        id: "cb",
        from: { id: 5 },
        message: { chat: { id: 5 } },
        data: "d:1234abcd:tag:2",
      },
    };
    expect((await POST(request(update, "secret"))).status).toBe(200);
    expect(handleCatalogUpdate).toHaveBeenCalledWith(update, undefined, { delivery: "deferred", acknowledge: false });
  });
  it("parses only bounded known callback actions", () => {
    expect(parseCallback("d:1234abcd:tag:2")).toMatchObject({
      action: "tag",
      id: 2,
    });
    expect(parseCallback("d:1234abcd:sql:2")).toBeNull();
    expect(parseCallback("d:1234abcd:tag:-1")).toBeNull();
  });
  it("toggles tags without clearing previous selections", () => {
    expect(toggleTag([1], 2)).toEqual([1, 2]);
    expect(toggleTag([1, 2], 1)).toEqual([2]);
  });
});

it("rejects oversized streamed webhook bodies before parsing", async () => {
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "secret");
  expect((await POST(request({ padding: "x".repeat(65_000) }, "secret"))).status).toBe(400);
  expect(handleCatalogUpdate).not.toHaveBeenCalled();
});


it("returns after durable planning even when Telegram acknowledgement and delivery hang", async () => {
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "secret");
  vi.mocked(acknowledgeCatalogCallback).mockReturnValueOnce(new Promise(() => {}));
  vi.mocked(deliverCatalogUpdate).mockReturnValueOnce(new Promise(() => {}));
  const update = { update_id: 99, callback_query: { id: "slow", from: { id: 5 }, message: { chat: { id: 5 } }, data: "d:1234abcd:results:0" } };
  const response = await Promise.race([POST(request(update, "secret")), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Webhook waited for Telegram")), 100))]);
  expect(response.status).toBe(200);
  expect(handleCatalogUpdate).toHaveBeenCalledWith(update, undefined, { delivery: "deferred", acknowledge: false });
  expect(after).toHaveBeenCalledWith(expect.any(Function));
  expect(deliverCatalogUpdate).not.toHaveBeenCalled();
});
