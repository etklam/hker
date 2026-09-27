import { describe, expect, it, vi } from "vitest";
import { inspectDirectorySchema } from "./schema-contract";

describe("directory schema readiness contract", () => {
  it("fails web readiness when mandatory columns are absent", async () => {
    const executor = { execute: vi.fn().mockResolvedValue([
      { tableName: "directory_listings", columnName: "revision" },
    ]) } as never;
    const result = await inspectDirectorySchema("web", executor);
    expect(result.compatible).toBe(false);
    expect(result.missing).toContain("directory_listings.name");
    expect(result.missing).toContain("directory_listing_links.url");
  });

  it("requires worker tables only for the worker contract", async () => {
    const executor = { execute: vi.fn().mockResolvedValue([]) } as never;
    const result = await inspectDirectorySchema("worker", executor);
    expect(result.missing).toContain("directory_bot_updates.operations");
    expect(result.missing).toContain("directory_bot_sessions.lease_owner");
  });
});
