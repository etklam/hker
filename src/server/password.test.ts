// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
describe("password compatibility and malformed storage", () => {
  it("retains existing salt/hash representation and rejects damaged hashes without callback crashes", async () => {
    const stored = await hashPassword("fictional-password");
    expect(stored).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(await verifyPassword("fictional-password", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
    for (const damaged of [
      null,
      "",
      "abc",
      "00:00",
      `${"gg".repeat(16)}:${"00".repeat(64)}`,
      `${stored}:extra`,
    ])
      expect(await verifyPassword("fictional-password", damaged)).toBe(false);
  });
});
