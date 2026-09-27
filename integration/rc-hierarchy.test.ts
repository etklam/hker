import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { areas } from "@/db/schema/directory";
import { catalogHistory } from "@/db/schema/directoryOperations";
import { commitTaxonomyImport } from "@/server/catalog/taxonomy-import";
import { createDatabase, db } from "@/server/db";
import {
  deleteTaxonomy,
  getTaxonomy,
  saveTaxonomy,
} from "@/server/catalog/service";

if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test"))
  throw new Error("Use isolated hker_directory_test only");

const connections = Array.from({ length: 4 }, () =>
  createDatabase(process.env.DATABASE_URL!, { max: 1 }),
);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function backendPid(database: (typeof connections)[number]["db"]) {
  const rows = await database.execute(sql`select pg_backend_pid()::int as pid`);
  return Number(rows[0].pid);
}

async function holdHierarchyLock() {
  const acquired = deferred();
  const release = deferred();
  const pid = await backendPid(connections[0].db);
  const done = connections[0].db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(724110)`);
    acquired.resolve();
    await release.promise;
  });
  await acquired.promise;
  return { pid, release: release.resolve, done };
}

async function waitUntilBlocked(pids: number[], blockerPid: number) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rows = await connections[3].db.execute(sql`
      select pid, ${blockerPid} = any(pg_blocking_pids(pid)) as blocked
      from pg_stat_activity
      where pid in ${sql`(${sql.join(
        pids.map((pid) => sql`${pid}`),
        sql`, `,
      )})`}
    `);
    if (
      rows.length === pids.length &&
      rows.every((row) => row.blocked === true)
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `Sessions ${pids.join(", ")} did not reach the hierarchy barrier`,
  );
}

function nativeAreaSource(slug: string) {
  return JSON.stringify({
    format: "hker-catalog",
    version: 1,
    exportedAt: new Date(0).toISOString(),
    listings: [
      {
        name: "RC-03 placeholder",
        slug: "rc03-placeholder",
        priceMin: null,
        priceMax: null,
        categorySlug: null,
        areaSlug: null,
        tagSlugs: [],
      },
    ],
    taxonomy: {
      categories: [],
      groups: [],
      areas: [{ name: "匯入地區", slug, parentSlug: null }],
      tags: [],
      navigation: [],
    },
  });
}

beforeEach(async () => {
  await db.execute(
    sql`truncate directory_content_history, directory_listings, directory_categories, directory_areas, directory_tags, directory_tag_groups, directory_navigation_presets restart identity cascade`,
  );
});

afterAll(async () => {
  await Promise.all(connections.map((connection) => connection.close()));
});

describe("RC-03 area hierarchy lock order", () => {
  it("waits for the hierarchy lock before locking edited area rows", async () => {
    const first = await saveTaxonomy("areas", {
      name: "甲區",
      slug: "rc03-first",
    });
    const second = await saveTaxonomy("areas", {
      name: "乙區",
      slug: "rc03-second",
    });
    const blocker = await holdHierarchyLock();
    const pids = await Promise.all([
      backendPid(connections[1].db),
      backendPid(connections[2].db),
    ]);
    const edits = [
      saveTaxonomy(
        "areas",
        { name: "甲區", slug: first.slug, parentId: second.id },
        first.id,
        {},
        connections[1].db,
      ),
      saveTaxonomy(
        "areas",
        { name: "乙區（更新）", slug: second.slug },
        second.id,
        {},
        connections[2].db,
      ),
    ];
    let observationError: unknown;
    let probeRows: unknown[] = [];
    try {
      await waitUntilBlocked(pids, blocker.pid);
      probeRows = await connections[3].db.execute(sql`
          select id from directory_areas
          where id in (${first.id}, ${second.id})
          order by id for update nowait
        `);
    } catch (error) {
      observationError = error;
    } finally {
      blocker.release();
      await blocker.done;
    }
    const results = await Promise.allSettled(edits);
    if (observationError) throw observationError;
    expect(probeRows).toHaveLength(2);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const taxonomy = await getTaxonomy("admin");
    expect(taxonomy.areas.find((row) => row.id === first.id)?.parentId).toBe(
      second.id,
    );
    expect(taxonomy.areas.find((row) => row.id === second.id)?.name).toBe(
      "乙區（更新）",
    );
  });

  it("serializes simultaneous cycle proposals and records only the valid edit", async () => {
    const first = await saveTaxonomy("areas", {
      name: "丙區",
      slug: "rc03-third",
    });
    const second = await saveTaxonomy("areas", {
      name: "丁區",
      slug: "rc03-fourth",
    });
    await db.delete(catalogHistory);
    const blocker = await holdHierarchyLock();
    const pids = await Promise.all([
      backendPid(connections[1].db),
      backendPid(connections[2].db),
    ]);
    const edits = [
      saveTaxonomy(
        "areas",
        { name: first.name, slug: first.slug, parentId: second.id },
        first.id,
        {},
        connections[1].db,
      ),
      saveTaxonomy(
        "areas",
        { name: second.name, slug: second.slug, parentId: first.id },
        second.id,
        {},
        connections[2].db,
      ),
    ];
    let barrierError: unknown;
    try {
      await waitUntilBlocked(pids, blocker.pid);
    } catch (error) {
      barrierError = error;
    } finally {
      blocker.release();
      await blocker.done;
    }
    const results = await Promise.allSettled(edits);
    if (barrierError) throw barrierError;
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { code: "INVALID_REQUEST" } });
    const stored = await db.select().from(areas);
    const parents = new Map(stored.map((row) => [row.id, row.parentId]));
    expect(
      parents.get(first.id) === second.id &&
        parents.get(second.id) === first.id,
    ).toBe(false);
    expect(await db.select().from(catalogHistory)).toHaveLength(1);
  });

  it("releases import hierarchy locks on rollback and permits the next edit", async () => {
    const existing = await saveTaxonomy("areas", {
      name: "現有地區",
      slug: "rc03-existing",
    });
    const blocker = await holdHierarchyLock();
    const pids = await Promise.all([
      backendPid(connections[1].db),
      backendPid(connections[2].db),
    ]);
    const importedSlug = "rc03-imported";
    const imported = connections[1].db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(724111)`);
      await commitTaxonomyImport(nativeAreaSource(importedSlug), tx, {});
      throw new Error("intentional RC-03 rollback");
    });
    const edited = saveTaxonomy(
      "areas",
      { name: "現有地區（並行更新）", slug: existing.slug },
      existing.id,
      {},
      connections[2].db,
    );
    let barrierError: unknown;
    try {
      await waitUntilBlocked(pids, blocker.pid);
    } catch (error) {
      barrierError = error;
    } finally {
      blocker.release();
      await blocker.done;
    }
    const outcomes = await Promise.allSettled([imported, edited]);
    if (barrierError) throw barrierError;
    expect(outcomes[0]).toMatchObject({
      status: "rejected",
      reason: { message: "intentional RC-03 rollback" },
    });
    expect(outcomes[1].status).toBe("fulfilled");
    expect(
      (await getTaxonomy("admin")).areas.some(
        (row) => row.slug === importedSlug,
      ),
    ).toBe(false);
    await expect(
      saveTaxonomy(
        "areas",
        { name: "現有地區（鎖已釋放）", slug: existing.slug },
        existing.id,
      ),
    ).resolves.toMatchObject({ name: "現有地區（鎖已釋放）" });
  });

  it("records a successful area deletion with its mutation context", async () => {
    const area = await saveTaxonomy("areas", {
      name: "待刪地區",
      slug: "rc03-delete",
    });
    await db.delete(catalogHistory);
    await deleteTaxonomy("areas", area.id, { actorId: 77 });
    const [entry] = await db.select().from(catalogHistory);
    expect(entry).toMatchObject({
      actorId: 77,
      entity: "areas",
      entityId: area.id,
      action: "delete",
      changes: { name: { before: "待刪地區", after: null } },
    });
  });
});
