import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { loginFailures, rateLimitEntries } from "@/db/schema/rateLimit";
import {
  isAccountLocked,
  rateLimit,
  trackLoginFailure,
} from "@/server/api-helpers";

const rateKey = `integration-concurrent-rate-${Date.now()}`;
const email = `concurrent-${Date.now()}@example.test`;

beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (url.pathname !== "/hker_directory_test")
    throw new Error("Security integration tests require hker_directory_test");
});

afterAll(async () => {
  await db.delete(rateLimitEntries).where(eq(rateLimitEntries.key, rateKey));
  await db.delete(loginFailures).where(eq(loginFailures.email, email));
});

describe("concurrent authentication boundaries", () => {
  it("admits no more than the configured number of parallel requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => rateLimit(rateKey, 5, 60_000)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(15);
  });

  it("does not lose parallel login failures", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => trackLoginFailure(email)),
    );
    const rows = await db
      .select()
      .from(loginFailures)
      .where(eq(loginFailures.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].failCount).toBe(10);
    expect(await isAccountLocked(email)).toBe(true);
  });
});
