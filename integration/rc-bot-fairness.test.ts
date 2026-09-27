import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, gte, lt, like } from "drizzle-orm";
import { db } from "@/server/db";
import { botChatLeases, botRunnerState, botSessions, botUpdates } from "@/db/schema/directory";
import { runBotDelivery } from "@/server/catalog/bot-delivery";
import * as transport from "@/server/catalog/bot-transport";

if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test"))
  throw new Error("Requires disposable hker_directory_test");

const ID_START = 92_000_000;
const ID_END = 92_001_000;
const KEY_PREFIX = "rc02-";
const CLOCK = new Date("2040-01-02T03:04:05.000Z");
const CONFIG = { leaseSeconds: 30, maxAttempts: 3, maxAgeSeconds: 3_600, baseDelayMs: 100, maxDelayMs: 1_000, jitterRatio: 0 };
const LONG_CONFIG = { ...CONFIG, maxAgeSeconds: 86_400 };
const operation = (chat: string, text: string) => [{ method: "sendMessage", body: { chat_id: chat, text } }];

async function cleanupFixture() {
  await db.delete(botUpdates).where(and(gte(botUpdates.id, ID_START), lt(botUpdates.id, ID_END)));
  await db.delete(botSessions).where(like(botSessions.key, `${KEY_PREFIX}%`));
  await db.delete(botChatLeases).where(like(botChatLeases.key, `${KEY_PREFIX}%`));
  await db.delete(botRunnerState).where(like(botRunnerState.runnerId, `${KEY_PREFIX}%`));
}

async function update(id: number) {
  const [row] = await db.select().from(botUpdates).where(eq(botUpdates.id, id));
  return row;
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await cleanupFixture();
});
afterAll(cleanupFixture);

describe("RC-02 bot delivery fairness", () => {
  it("selects runnable chat heads before applying the global batch limit", async () => {
    const due = new Date(CLOCK.getTime() - 1_000);
    const delayed = new Date(CLOCK.getTime() + 60 * 60_000);
    const createdAt = new Date(CLOCK.getTime() - 60_000);
    const aKey = `${KEY_PREFIX}a:user`;
    const bKey = `${KEY_PREFIX}b:user`;
    const cKey = `${KEY_PREFIX}c:user`;
    await db.insert(botSessions).values([
      { key: aKey, state: {} },
      { key: bKey, state: {} },
      { key: cKey, state: {} },
    ]);
    await db.insert(botUpdates).values([
      { id: ID_START, conversationKey: aKey, chatKey: `${KEY_PREFIX}a`, nextAttemptAt: delayed, createdAt, operations: operation(`${KEY_PREFIX}a`, "a-head") },
      ...Array.from({ length: 150 }, (_, index) => ({
        id: ID_START + 1 + index,
        conversationKey: aKey,
        chatKey: `${KEY_PREFIX}a`,
        nextAttemptAt: due,
        createdAt,
        operations: operation(`${KEY_PREFIX}a`, `a-${index + 1}`),
      })),
      { id: ID_START + 151, conversationKey: bKey, chatKey: `${KEY_PREFIX}b`, nextAttemptAt: due, createdAt, operations: operation(`${KEY_PREFIX}b`, "b") },
      { id: ID_START + 152, conversationKey: cKey, chatKey: `${KEY_PREFIX}c`, nextAttemptAt: due, createdAt, operations: operation(`${KEY_PREFIX}c`, "c") },
    ]);
    const sent: string[] = [];
    vi.spyOn(transport, "telegram").mockImplementation(async (_method, body) => {
      sent.push(String(body.text));
      return { message_id: 1 };
    });

    const first = await runBotDelivery(100, { runnerId: `${KEY_PREFIX}runner`, now: CLOCK, config: LONG_CONFIG });

    expect(first).toMatchObject({ scanned: 2, eligible: 2, claimed: 2, completed: 2 });
    expect((await update(ID_START)).status).toBe("pending");
    expect((await update(ID_START + 151)).status).toBe("complete");
    expect((await update(ID_START + 152)).status).toBe("complete");

    const advanced = new Date(CLOCK.getTime() + 2 * 60 * 60_000);
    const second = await runBotDelivery(100, { runnerId: `${KEY_PREFIX}runner`, now: advanced, config: LONG_CONFIG });
    const third = await runBotDelivery(100, { runnerId: `${KEY_PREFIX}runner`, now: advanced, config: LONG_CONFIG });
    expect(second.completed).toBe(100);
    expect(third.completed).toBe(51);
    expect((await update(ID_START)).status).toBe("complete");
    expect((await update(ID_START + 150)).status).toBe("complete");
    expect(sent.filter((text) => text.startsWith("a-") || text === "a-head")).toEqual([
      "a-head",
      ...Array.from({ length: 150 }, (_, index) => `a-${index + 1}`),
    ]);
  });

  it("handles live and expired leases, expired-age blockers and failed heads", async () => {
    const due = new Date(CLOCK.getTime() - 1_000);
    const recent = new Date(CLOCK.getTime() - 60_000);
    const live = new Date(CLOCK.getTime() + 60_000);
    const expired = new Date(CLOCK.getTime() - 60_000);
    const leasedKey = `${KEY_PREFIX}leased:user`;
    const otherKey = `${KEY_PREFIX}other:user`;
    await db.insert(botSessions).values([{ key: leasedKey, state: {} }, { key: otherKey, state: {} }]);
    await db.insert(botUpdates).values([
      { id: ID_START + 300, conversationKey: leasedKey, chatKey: `${KEY_PREFIX}leased`, nextAttemptAt: due, createdAt: recent, lockedUntil: live, leaseOwner: "live-owner", operations: operation(`${KEY_PREFIX}leased`, "leased-head") },
      { id: ID_START + 301, conversationKey: leasedKey, chatKey: `${KEY_PREFIX}leased`, nextAttemptAt: due, createdAt: recent, operations: operation(`${KEY_PREFIX}leased`, "leased-next") },
      { id: ID_START + 302, conversationKey: otherKey, chatKey: `${KEY_PREFIX}other`, nextAttemptAt: due, createdAt: recent, operations: operation(`${KEY_PREFIX}other`, "other") },
    ]);
    const sent: string[] = [];
    vi.spyOn(transport, "telegram").mockImplementation(async (_method, body) => {
      sent.push(String(body.text));
      return { message_id: 2 };
    });

    const liveLeaseRun = await runBotDelivery(100, { runnerId: `${KEY_PREFIX}leases`, now: CLOCK, config: CONFIG });
    expect(liveLeaseRun).toMatchObject({ scanned: 1, eligible: 1, claimed: 1, completed: 1, retried: 0, expired: 0, blocked: 0 });
    expect((await update(ID_START + 300)).status).toBe("pending");
    expect((await update(ID_START + 301)).status).toBe("pending");
    expect((await update(ID_START + 302)).status).toBe("complete");

    await db.update(botUpdates).set({ lockedUntil: expired }).where(eq(botUpdates.id, ID_START + 300));
    await runBotDelivery(100, { runnerId: `${KEY_PREFIX}leases`, now: CLOCK, config: CONFIG });
    expect((await update(ID_START + 300)).status).toBe("complete");
    expect((await update(ID_START + 301)).status).toBe("complete");

    const expiredKey = `${KEY_PREFIX}age:user`;
    await db.insert(botSessions).values({ key: expiredKey, state: {} });
    await db.insert(botUpdates).values([
      { id: ID_START + 310, conversationKey: expiredKey, chatKey: `${KEY_PREFIX}age`, nextAttemptAt: live, createdAt: new Date(CLOCK.getTime() - 2 * 60 * 60_000), operations: operation(`${KEY_PREFIX}age`, "expired-age") },
      { id: ID_START + 311, conversationKey: expiredKey, chatKey: `${KEY_PREFIX}age`, nextAttemptAt: due, createdAt: recent, operations: operation(`${KEY_PREFIX}age`, "after-expired-age") },
    ]);
    const expiryRun = await runBotDelivery(100, { runnerId: `${KEY_PREFIX}age`, now: CLOCK, config: CONFIG });
    expect(expiryRun).toMatchObject({ scanned: 2, eligible: 2, claimed: 0, completed: 0, retried: 0, expired: 1, blocked: 1 });
    expect(await update(ID_START + 310)).toMatchObject({ status: "failed", errorClass: "expired" });
    expect((await update(ID_START + 311)).status).toBe("pending");
    await runBotDelivery(100, { runnerId: `${KEY_PREFIX}age`, now: CLOCK, config: CONFIG });
    expect((await update(ID_START + 311)).status).toBe("complete");
    expect(sent).not.toContain("expired-age");

    const failedKey = `${KEY_PREFIX}failed:user`;
    await db.insert(botSessions).values({ key: failedKey, state: {} });
    await db.insert(botUpdates).values([
      { id: ID_START + 320, conversationKey: failedKey, chatKey: `${KEY_PREFIX}failed`, status: "failed", completedAt: CLOCK, nextAttemptAt: due, createdAt: recent, operations: operation(`${KEY_PREFIX}failed`, "failed") },
      { id: ID_START + 321, conversationKey: failedKey, chatKey: `${KEY_PREFIX}failed`, nextAttemptAt: due, createdAt: recent, operations: operation(`${KEY_PREFIX}failed`, "after-failed") },
    ]);
    await runBotDelivery(100, { runnerId: `${KEY_PREFIX}failed`, now: CLOCK, config: CONFIG });
    expect((await update(ID_START + 321)).status).toBe("complete");
  });

  it("recovers acknowledged progress once across concurrent runners", async () => {
    const due = new Date(CLOCK.getTime() - 1_000);
    const key = `${KEY_PREFIX}recovery:user`;
    await db.insert(botSessions).values({ key, state: {}, leaseOwner: "crashed", lockedUntil: new Date(CLOCK.getTime() - 60_000) });
    await db.insert(botUpdates).values({
      id: ID_START + 400,
      conversationKey: key,
      chatKey: `${KEY_PREFIX}recovery`,
      status: "delivering",
      leaseOwner: "crashed",
      lockedUntil: new Date(CLOCK.getTime() - 60_000),
      nextAttemptAt: due,
      createdAt: new Date(CLOCK.getTime() - 60_000),
      operations: [
        { method: "sendMessage", body: { chat_id: `${KEY_PREFIX}recovery`, text: "acknowledged" } },
        { method: "sendMessage", body: { chat_id: `${KEY_PREFIX}recovery`, text: "remaining" } },
      ],
      nextOperation: 1,
    });
    const sent: string[] = [];
    vi.spyOn(transport, "telegram").mockImplementation(async (_method, body) => {
      sent.push(String(body.text));
      await Promise.resolve();
      return { message_id: 3 };
    });

    const results = await Promise.all([
      runBotDelivery(100, { runnerId: `${KEY_PREFIX}concurrent-1`, now: CLOCK, config: CONFIG }),
      runBotDelivery(100, { runnerId: `${KEY_PREFIX}concurrent-2`, now: CLOCK, config: CONFIG }),
    ]);

    expect((await update(ID_START + 400)).status).toBe("complete");
    expect(sent).toEqual(["remaining"]);
    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.completed, 0)).toBe(1);
  });

  it("does not report completion or release leases after ownership changes", async () => {
    const due = new Date(CLOCK.getTime() - 1_000);
    const key = `${KEY_PREFIX}stale:user`;
    const chatKey = `${KEY_PREFIX}stale`;
    await db.insert(botSessions).values({ key, state: {} });
    await db.insert(botUpdates).values({
      id: ID_START + 500,
      conversationKey: key,
      chatKey,
      nextAttemptAt: due,
      createdAt: new Date(CLOCK.getTime() - 60_000),
      operations: operation(chatKey, "late-response"),
    });
    vi.spyOn(transport, "telegram").mockImplementation(async () => {
      const replacementUntil = new Date(CLOCK.getTime() + 60_000);
      await db.update(botUpdates).set({ leaseOwner: "replacement", lockedUntil: replacementUntil }).where(eq(botUpdates.id, ID_START + 500));
      await db.update(botSessions).set({ leaseOwner: "replacement", lockedUntil: replacementUntil }).where(eq(botSessions.key, key));
      await db.update(botChatLeases).set({ leaseOwner: "replacement", lockedUntil: replacementUntil }).where(eq(botChatLeases.key, chatKey));
      return { message_id: 4 };
    });

    const result = await runBotDelivery(100, { runnerId: `${KEY_PREFIX}stale`, now: CLOCK, config: CONFIG });

    expect(result).toMatchObject({ scanned: 1, eligible: 1, claimed: 1, completed: 0, retried: 0, expired: 0, blocked: 0 });
    expect(await update(ID_START + 500)).toMatchObject({ status: "delivering", leaseOwner: "replacement", nextOperation: 0 });
    const [session] = await db.select().from(botSessions).where(eq(botSessions.key, key));
    const [chat] = await db.select().from(botChatLeases).where(eq(botChatLeases.key, chatKey));
    expect(session.leaseOwner).toBe("replacement");
    expect(chat.leaseOwner).toBe("replacement");
  });
});
