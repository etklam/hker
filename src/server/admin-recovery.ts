import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { users } from "@/db/schema/users";
import { authIdentities, authSessions } from "@/db/schema/auth";
import { hashPassword } from "./password";

export async function recoverAdministrator(raw: unknown) {
  const input = z
    .object({
      email: z.email().max(255),
      password: z.string().min(12).max(4096),
    })
    .parse(raw);
  const email = input.email.toLowerCase();
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          inArray(users.role, ["admin", "superadmin"]),
        ),
      )
      .limit(1)
      .for("update");
    if (!user || user.banned)
      throw new Error("Existing active administrator required");
    const changed = await tx
      .update(authIdentities)
      .set({ passwordHash, updatedAt: new Date() })
      .where(
        and(
          eq(authIdentities.userId, user.id),
          eq(authIdentities.provider, "password"),
        ),
      )
      .returning({ id: authIdentities.id });
    if (changed.length !== 1)
      throw new Error("Exactly one password identity required");
    const revoked = await tx
      .delete(authSessions)
      .where(eq(authSessions.userId, user.id))
      .returning({ id: authSessions.id });
    return { recovered: true, revokedSessions: revoked.length };
  });
}
