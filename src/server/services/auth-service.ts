import { hashPassword, verifyPassword } from "@/server/password";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { authIdentities } from "@/db/schema/auth";
import { AppError } from "@/lib/errors";
import * as userService from "@/server/services/user-service";

export async function register(
  email: string,
  password: string,
  displayName?: string,
  role: "user" | "admin" = "user",
) {
  const normalizedEmail = email.toLowerCase();
  const passwordHashValue = await hashPassword(password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert((await import("@/db/schema/users")).users)
      .values({
        email: normalizedEmail,
        displayName: displayName ?? null,
        role,
      })
      .returning();

    await tx.insert(authIdentities).values({
      userId: user.id,
      provider: "password",
      providerSubject: normalizedEmail,
      passwordHash: passwordHashValue,
      email: normalizedEmail,
    });

    return user;
  });
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase();

  const [identity] = await db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, "password"),
        eq(authIdentities.providerSubject, normalizedEmail),
      ),
    )
    .limit(1);

  const valid = await verifyPassword(password, identity?.passwordHash);
  if (!identity || !valid) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  const user = await userService.findById(identity.userId);
  if (!user || user.banned) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  await db
    .update(authIdentities)
    .set({ lastUsedAt: new Date() })
    .where(eq(authIdentities.id, identity.id));

  return user;
}
