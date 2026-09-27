import { beforeEach, describe, expect, it, vi } from "vitest";

const { inspectDirectorySchema } = vi.hoisted(() => ({ inspectDirectorySchema: vi.fn() }));
vi.mock("@/server/catalog/schema-contract", () => ({ inspectDirectorySchema }));

import { GET } from "./route";

describe("readiness endpoint", () => {
  beforeEach(() => vi.resetAllMocks());
  it("returns a minimal 503 for an incompatible mandatory schema", async () => {
    inspectDirectorySchema.mockResolvedValue({ component: "web", compatible: false, missing: ["directory_listings.revision"] });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("returns ready for the web schema contract", async () => {
    inspectDirectorySchema.mockResolvedValue({ component: "web", compatible: true, missing: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });
});
