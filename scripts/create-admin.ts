import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import { users } from "../src/db/schema/users";
import { register } from "../src/server/services/auth-service";
import { z } from "zod";
async function main() {
  const input = z
    .object({
      email: z.email(),
      password: z.string().min(12),
      name: z.string().optional(),
    })
    .parse({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME,
    });
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);
  if (existing) throw new Error("Account already exists; no changes made");
  const user = await register(input.email, input.password, input.name);
  await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  console.log("Administrator created");
  process.exit(0);
}
main().catch(() => {
  console.error(
    "Administrator creation failed. Check credentials, database and whether the account already exists.",
  );
  process.exit(1);
});
