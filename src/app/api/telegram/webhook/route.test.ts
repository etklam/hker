import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("@/server/catalog/bot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/catalog/bot")>();
  return { ...actual, handleCatalogUpdate: vi.fn() };
});
import { POST } from "./route";
import {
  handleCatalogUpdate,
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
    expect(handleCatalogUpdate).toHaveBeenCalledWith(update);
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
