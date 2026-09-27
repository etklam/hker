import { eq } from "drizzle-orm";
import { db, closeDatabase } from "../src/server/db";
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
  await register(input.email, input.password, input.name, "admin");
  console.log("Administrator created");
}
main().catch((error) => {
  console.error(
    error instanceof Error && error.message === "Account already exists; no changes made"
      ? error.message
      : "Administrator creation failed. Check credentials, database and whether the account already exists.",
  );
  process.exitCode = 1;
}).finally(closeDatabase);
