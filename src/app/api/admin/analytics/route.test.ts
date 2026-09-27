import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  remove: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/server/api-helpers", () => ({
  withAdmin: (handler: unknown) => handler,
}));
vi.mock("@/server/catalog/analytics", () => ({
  analyticsReport: mocks.report,
  deleteStoredQuery: mocks.remove,
  hongKongDay: () => "2026-09-28",
  privateQueryKey: (value: string) =>
    value === "流動維修" ? value : null,
}));
vi.mock("@/server/catalog/service", () => ({
  CatalogSearchService: { search: mocks.search },
}));

import { GET } from "./route";

describe("GET /api/admin/analytics current-result inspection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a timestamped public total without writing an event", async () => {
    mocks.search.mockResolvedValue({ total: 3, items: [] });
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/analytics?inspect=%E6%B5%81%E5%8B%95%E7%B6%AD%E4%BF%AE",
      ),
      { user: { id: 1, role: "admin" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ query: "流動維修", total: 3 });
    expect(Date.parse(body.inspectedAt)).not.toBeNaN();
    expect(mocks.search).toHaveBeenCalledWith(
      { query: "流動維修", page: 1, pageSize: 1 },
      "public",
    );
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("rejects a query that would not be eligible for stored analytics", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/analytics?inspect=person%40example.com",
      ),
      { user: { id: 1, role: "admin" } },
    );

    expect(response.status).toBe(400);
    expect(mocks.search).not.toHaveBeenCalled();
  });
});
