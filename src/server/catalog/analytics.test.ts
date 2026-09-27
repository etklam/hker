import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  issueCatalogEventReceipt,
  issueCatalogSearchObservation,
  verifyCatalogEventReceipt,
  verifyCatalogSearchObservation,
} from "./analytics";

const secret = "test-only-analytics-observation-secret";
const at = new Date("2026-09-27T10:00:00.000Z");

describe("catalog analytics provenance", () => {
  beforeEach(() => {
    process.env.ANALYTICS_ACTION_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.ANALYTICS_ACTION_SECRET;
  });

  it("binds the authoritative result and normalized criteria without exposing the query", () => {
    const search = { query: "  手機   維修  ", categoryId: 3 };
    const observation = issueCatalogSearchObservation(
      "search",
      search.query,
      search,
      0,
      at,
    );

    expect(observation).not.toBeNull();
    expect(JSON.stringify(observation)).not.toContain("手機");
    expect(
      verifyCatalogSearchObservation(
        observation!,
        "search",
        "手機 維修",
        search,
        at,
      ),
    ).toBe(true);
    expect(
      verifyCatalogSearchObservation(
        { ...observation!, resultCount: 1 },
        "search",
        "手機 維修",
        search,
        at,
      ),
    ).toBe(false);
    expect(
      verifyCatalogSearchObservation(
        observation!,
        "search",
        "另一搜尋",
        search,
        at,
      ),
    ).toBe(false);
  });

  it("rejects the wrong purpose, source, expiry, and signing configuration", () => {
    const observation = issueCatalogSearchObservation(
      "filter",
      "applied",
      { areaId: 2 },
      4,
      at,
    )!;
    const check = (value = observation, now = at) =>
      verifyCatalogSearchObservation(
        value,
        "filter",
        "applied",
        { areaId: 2 },
        now,
      );

    expect(
      check({ ...observation, purpose: "wrong" as typeof observation.purpose }),
    ).toBe(false);
    expect(
      check({ ...observation, source: "bot" as typeof observation.source }),
    ).toBe(false);
    expect(check(observation, new Date(at.getTime() + 10 * 60_000 + 1))).toBe(
      false,
    );
    process.env.ANALYTICS_ACTION_SECRET = "changed-secret";
    expect(check()).toBe(false);
  });

  it("uses a short-lived purpose-bound receipt for navigation actions", () => {
    const receipt = issueCatalogEventReceipt(at)!;
    expect(verifyCatalogEventReceipt(receipt, at)).toBe(true);
    expect(
      verifyCatalogEventReceipt(
        { ...receipt, purpose: "wrong" as typeof receipt.purpose },
        at,
      ),
    ).toBe(false);
    expect(
      verifyCatalogEventReceipt(
        receipt,
        new Date(at.getTime() + 10 * 60_000 + 1),
      ),
    ).toBe(false);

    const legacy = {
      actionId: "640814d4-f921-45f3-a373-68444b8050d3",
      occurredAt: at.toISOString(),
      signature: createHmac("sha256", secret)
        .update(`640814d4-f921-45f3-a373-68444b8050d3:${at.toISOString()}`)
        .digest("hex"),
    };
    expect(verifyCatalogEventReceipt(legacy, at)).toBe(true);
    expect(
      verifyCatalogEventReceipt(
        legacy,
        new Date(at.getTime() + 10 * 60_000 + 1),
      ),
    ).toBe(false);
  });
});
