import { afterAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/db/schema/users";
import { authSessions } from "@/db/schema/auth";
import { register, login } from "@/server/services/auth-service";
import { createSession, validateSession } from "@/server/services/session-service";
import { recoverAdministrator } from "@/server/admin-recovery";
import { cleanupAuthentication, MAX_RATE_WINDOW_MS } from "@/server/auth-cleanup";
import { rateLimitEntries } from "@/db/schema/rateLimit";
const email = "completion-recovery@example.test";
afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  await db.delete(rateLimitEntries).where(eq(rateLimitEntries.key, "completion-retention"));
});
describe("authentication maintenance", () => {
  it("updates activity once across concurrent readers and scopes offline recovery", async () => {
    await db.delete(users).where(eq(users.email, email));
    const user = await register(email, "fictional-password-before", "Fictional admin", "admin");
    const token = await createSession(user.id);
    await db.update(authSessions).set({ lastSeenAt: new Date(0) }).where(eq(authSessions.userId, user.id));
    await db.execute(sql`create table completion_session_touches(id integer)`);
    await db.execute(sql`create function completion_count_touch() returns trigger language plpgsql as $$ begin insert into completion_session_touches values(new.id); return new; end $$`);
    await db.execute(sql`create trigger completion_touch after update on auth_sessions for each row execute function completion_count_touch()`);
    try {
      const results = await Promise.all(Array.from({ length: 12 }, () => validateSession(token)));
      expect(results.every(result => result?.user.id === user.id)).toBe(true);
      const rows = await db.execute(sql`select * from completion_session_touches`);
      expect(rows).toHaveLength(1);
    } finally {
      await db.execute(sql`drop trigger completion_touch on auth_sessions`);
      await db.execute(sql`drop function completion_count_touch()`);
      await db.execute(sql`drop table completion_session_touches`);
    }
    await expect(recoverAdministrator({ email: "typo@example.test", password: "fictional-password-after" })).rejects.toThrow("Existing active administrator required");
    expect(await recoverAdministrator({ email, password: "fictional-password-after" })).toEqual({ recovered: true, revokedSessions: 1 });
    expect(await validateSession(token)).toBeNull();
    await expect(login(email, "fictional-password-before")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((await login(email, "fictional-password-after")).role).toBe("admin");
    await db.update(users).set({ banned: true }).where(eq(users.id, user.id));
    await expect(login(email, "fictional-password-after")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await db.update(users).set({ role: "user", banned: false }).where(eq(users.id, user.id));
    await expect(recoverAdministrator({ email, password: "fictional-another-password" })).rejects.toThrow("Existing active administrator required");
  });
  it("preserves the complete longest supported rate window and bounds deletion", async () => {
    const now = new Date("2001-01-02T00:00:00Z");
    const cutoff = new Date(now.getTime() - MAX_RATE_WINDOW_MS);
    await db.delete(rateLimitEntries).where(eq(rateLimitEntries.key, "completion-retention"));
    await db.insert(rateLimitEntries).values([
      { key: "completion-retention", hitAt: new Date(cutoff.getTime() - 1) },
      { key: "completion-retention", hitAt: cutoff },
      { key: "completion-retention", hitAt: now },
    ]);
    expect((await cleanupAuthentication(db, now, 1)).hits).toBe(1);
    expect(await db.select().from(rateLimitEntries).where(and(eq(rateLimitEntries.key, "completion-retention")))).toHaveLength(2);
    expect((await cleanupAuthentication(db, now, 1)).hits).toBe(0);
  });
});
