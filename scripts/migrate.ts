import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await client`select pg_advisory_lock(724113)`;
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    const expected = await Promise.all(
      journal.entries.map(async (entry: { tag: string; when: number }) => ({
        ...entry,
        hash: createHash("sha256")
          .update(await readFile(`drizzle/${entry.tag}.sql`, "utf8"))
          .digest("hex"),
      })),
    );
    const [exists] =
      await client`select to_regclass('drizzle.__drizzle_migrations') as ledger, to_regclass('public.users') as legacy`;
    const applied = exists.ledger
      ? await client`select hash,created_at from drizzle.__drizzle_migrations order by created_at`
      : [];
    if (
      (exists.legacy && !applied.length) ||
      applied.some(
        (row, index) =>
          !expected[index] ||
          row.hash !== expected[index].hash ||
          Number(row.created_at) !== expected[index].when,
      )
    )
      throw new Error(
        "Migration ledger mismatch. Stop; restore a backup into an isolated rehearsal database and reconcile history manually. No ledger or schema was changed.",
      );
    console.log(
      JSON.stringify({
        status: "compatible",
        applied: applied.length,
        pending: expected.slice(applied.length).map((e) => e.tag),
      }),
    );
    if (process.argv.includes("--apply")) {
      await migrate(drizzle(client), { migrationsFolder: "drizzle" });
      console.log("Migrations applied");
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
});
