import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/api-helpers", () => ({ rateLimit: vi.fn() }));
import { rateLimit } from "@/server/api-helpers";
import { guardPublicSearch } from "./abuse";

describe("public search failure classification", () => {
  it("keeps rate limits distinct from unavailable protection", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, retryAfterMs: 60000 });
    await expect(guardPublicSearch()).rejects.toMatchObject({ code: "RATE_LIMITED" });
    vi.mocked(rateLimit).mockRejectedValueOnce(new Error("private database diagnostic"));
    await expect(guardPublicSearch()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "搜尋服務暫時無法使用，請稍後重試。" });
  });
});
