import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allow: vi.fn(),
  enabled: vi.fn(),
  issue: vi.fn(),
  record: vi.fn(),
  verifyReceipt: vi.fn(),
  verifyObservation: vi.fn(),
}));

vi.mock("@/server/catalog/abuse", () => ({
  allowCatalogRequest: mocks.allow,
}));
vi.mock("@/server/catalog/analytics", () => ({
  analyticsEnabled: mocks.enabled,
  issueCatalogEventReceipt: mocks.issue,
  recordCatalogEvent: mocks.record,
  verifyCatalogEventReceipt: mocks.verifyReceipt,
  verifyCatalogSearchObservation: mocks.verifyObservation,
}));

import { POST } from "./route";

const observation = {
  version: 1,
  purpose: "catalog-search-observation",
  source: "web",
  actionId: "740814d4-f921-45f3-a373-68444b8050d3",
  observedAt: "2026-09-27T10:00:00.000Z",
  criteriaDigest: "b".repeat(64),
  resultCount: 0,
  signature: "c".repeat(64),
};

function request(body: unknown) {
  return new Request("http://localhost/api/catalog/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/catalog/events search observations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "http://localhost";
    mocks.allow.mockResolvedValue(true);
    mocks.enabled.mockReturnValue(true);
    mocks.verifyObservation.mockReturnValue(true);
    mocks.record.mockResolvedValue("recorded");
  });

  it("records the signed result count without executing another catalog search", async () => {
    const response = await POST(
      request({
        kind: "search",
        key: "沒有結果",
        source: "web",
        search: { query: "沒有結果", categoryId: 2 },
        observation,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.verifyObservation).toHaveBeenCalledWith(
      observation,
      "search",
      "沒有結果",
      expect.objectContaining({ query: "沒有結果", categoryId: 2 }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: observation.actionId,
        occurredAt: observation.observedAt,
        zeroResult: true,
      }),
    );
  });

  it("rejects an expired or tampered observation before analytics storage", async () => {
    mocks.verifyObservation.mockReturnValue(false);
    const response = await POST(
      request({
        kind: "filter",
        key: "applied",
        source: "web",
        search: { areaId: 2 },
        observation: { ...observation, resultCount: 9 },
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not turn an invalid search request into a zero-result event", async () => {
    const response = await POST(
      request({
        kind: "search",
        key: " ",
        source: "web",
        search: {},
        observation,
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.verifyObservation).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
