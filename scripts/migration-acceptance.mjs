import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const UPGRADE_DB = "hker_directory_migration_acceptance_upgrade";
const FRESH_DB = "hker_directory_migration_acceptance_fresh";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function guardedSourceUrl() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    process.env.ALLOW_DIRECTORY_TEST_RESET !== "1" ||
    url.pathname !== "/hker_directory_test" ||
    !["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
  ) {
    throw new Error(
      "Migration acceptance requires ALLOW_DIRECTORY_TEST_RESET=1 and a loopback hker_directory_test DATABASE_URL",
    );
  }
  return url;
}

function databaseUrl(source, name) {
  const url = new URL(source);
  url.pathname = `/${name}`;
  return url.toString();
}

async function recreateDatabase(admin, name) {
  assert([UPGRADE_DB, FRESH_DB].includes(name));
  await admin`select pg_terminate_backend(pid) from pg_stat_activity where datname=${name} and pid <> pg_backend_pid()`;
  await admin.unsafe(`drop database if exists "${name}"`);
  await admin.unsafe(`create database "${name}"`);
}

async function dropDatabase(admin, name) {
  assert([UPGRADE_DB, FRESH_DB].includes(name));
  await admin`select pg_terminate_backend(pid) from pg_stat_activity where datname=${name} and pid <> pg_backend_pid()`;
  await admin.unsafe(`drop database if exists "${name}"`);
}

async function baselineFolder() {
  const folder = await mkdtemp(join(tmpdir(), "hker-migrations-0000-0003-"));
  await mkdir(join(folder, "meta"));
  const journal = JSON.parse(
    await readFile(join(repo, "drizzle/meta/_journal.json"), "utf8"),
  );
  const entries = journal.entries.filter((entry) => entry.idx <= 3);
  assert.equal(entries.length, 4, "Expected immutable migrations 0000–0003");
  await writeFile(
    join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  for (const entry of entries)
    await cp(
      join(repo, `drizzle/${entry.tag}.sql`),
      join(folder, `${entry.tag}.sql`),
    );
  return folder;
}

async function seedBaseline(client) {
  const [category] = await client`
    insert into directory_categories(name, slug) values('升級分類', 'migration-category') returning id
  `;
  const [tag] = await client`
    insert into directory_tags(name, slug) values('升級標籤', 'migration-tag') returning id
  `;
  const [listing] = await client`
    insert into directory_listings(name, slug, category_id, enabled)
    values('升級保留項目', 'migration-listing', ${category.id}, true) returning id
  `;
  const [link] = await client`
    insert into directory_listing_links(listing_id, type, label, url)
    values(${listing.id}, 'website', '保留連結', 'https://example.test/kept') returning id
  `;
  await client`
    insert into directory_listing_tags(listing_id, tag_id) values(${listing.id}, ${tag.id})
  `;
  const [preset] = await client`
    insert into directory_navigation_presets(label) values('保留導覽') returning id
  `;
  await client`
    insert into directory_navigation_preset_tags(preset_id, tag_id) values(${preset.id}, ${tag.id})
  `;
  await client`
    insert into directory_bot_updates(id, operations, next_operation)
    values(987654321, '[{"method":"sendMessage","body":{"text":"legacy"}}]'::jsonb, 0)
  `;
  return { categoryId: category.id, tagId: tag.id, listingId: listing.id, linkId: link.id };
}

async function expectForeignKeyFailure(work) {
  await assert.rejects(work, (error) => error?.code === "23503");
}

async function verifyUpgrade(client, seeded) {
  const [listing] = await client`
    select id, category_id, aliases, revision from directory_listings where id=${seeded.listingId}
  `;
  assert.equal(listing.id, seeded.listingId);
  assert.equal(listing.category_id, seeded.categoryId);
  assert.deepEqual(listing.aliases, []);
  assert.equal(listing.revision, 1);
  const [link] = await client`
    select id, listing_id from directory_listing_links where id=${seeded.linkId}
  `;
  assert.deepEqual(link, { id: seeded.linkId, listing_id: seeded.listingId });
  await expectForeignKeyFailure(() =>
    client`delete from directory_categories where id=${seeded.categoryId}`,
  );
  await expectForeignKeyFailure(() =>
    client`delete from directory_tags where id=${seeded.tagId}`,
  );
  const [legacy] = await client`
    select status, completed_at, last_error from directory_bot_updates where id=987654321
  `;
  assert.equal(legacy.status, "failed");
  assert(!Number.isNaN(new Date(legacy.completed_at).getTime()));
  assert.match(legacy.last_error, /restart/i);
  const [tables] = await client`
    select
      to_regclass('public.directory_listing_slug_aliases') as aliases,
      to_regclass('public.directory_import_jobs') as imports,
      to_regclass('public.directory_event_days') as events
  `;
  assert(tables.aliases && tables.imports && tables.events);
}

async function migrationCount(client) {
  const [row] = await client`
    select count(*)::int as count from drizzle.__drizzle_migrations
  `;
  return row.count;
}

async function main() {
  const source = guardedSourceUrl();
  const baseline = await baselineFolder();
  const admin = postgres(source.toString(), { max: 1 });
  let upgrade;
  let fresh;
  try {
    await recreateDatabase(admin, UPGRADE_DB);
    await recreateDatabase(admin, FRESH_DB);

    upgrade = postgres(databaseUrl(source, UPGRADE_DB), { max: 1 });
    await migrate(drizzle(upgrade), { migrationsFolder: baseline });
    assert.equal(await migrationCount(upgrade), 4);
    const seeded = await seedBaseline(upgrade);
    await migrate(drizzle(upgrade), {
      migrationsFolder: join(repo, "drizzle"),
    });
    await verifyUpgrade(upgrade, seeded);

    fresh = postgres(databaseUrl(source, FRESH_DB), { max: 1 });
    await migrate(drizzle(fresh), {
      migrationsFolder: join(repo, "drizzle"),
    });
    const expected = JSON.parse(
      await readFile(join(repo, "drizzle/meta/_journal.json"), "utf8"),
    ).entries.length;
    assert.equal(await migrationCount(fresh), expected);
    const [freshTables] = await fresh`
      select
        to_regclass('public.directory_listings') as listings,
        to_regclass('public.directory_import_jobs') as imports,
        to_regclass('public.directory_event_days') as events
    `;
    assert(freshTables.listings && freshTables.imports && freshTables.events);

    console.log(
      JSON.stringify({
        status: "passed",
        upgrade: { from: 4, to: expected, preservedListingId: seeded.listingId, preservedLinkId: seeded.linkId },
        fresh: { migrations: expected },
      }),
    );
  } finally {
    if (upgrade) await upgrade.end({ timeout: 5 });
    if (fresh) await fresh.end({ timeout: 5 });
    await dropDatabase(admin, UPGRADE_DB);
    await dropDatabase(admin, FRESH_DB);
    await admin.end({ timeout: 5 });
    await rm(baseline, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration acceptance failed");
  process.exitCode = 1;
});
