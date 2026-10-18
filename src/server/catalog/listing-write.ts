import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { catalogPlans } from "@/db/schema/directoryOperations";
import { AppError } from "@/lib/errors";
import {
  configureCatalogTransaction,
  saveListingInTransaction,
} from "./service";

// Reuse expiring operation storage for explicit editor retries after response loss.
export async function saveListingWithReceipt(
  raw: unknown,
  id: number | undefined,
  actorId: number,
  requestKey: string,
) {
  const key = `editor:${actorId}:${requestKey}`;
  const digest = createHash("sha256")
    .update(JSON.stringify({ id, raw }))
    .digest("hex");
  return db.transaction(async (tx) => {
    await configureCatalogTransaction(tx);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
    const [prior] = await tx
      .select()
      .from(catalogPlans)
      .where(eq(catalogPlans.id, key));
    if (prior) {
      if (
        prior.actorId !== actorId ||
        prior.digest !== digest ||
        prior.expiresAt <= new Date()
      )
        throw new AppError(
          "CONFLICT",
          "此儲存識別已使用或逾時，請先核對最新資料。",
        );
      if (prior.result) return { ...prior.result.affected[0], replayed: true };
    }
    const row = await saveListingInTransaction(tx, raw, id, {
      actorId,
      operationId: key,
    });
    const affected = {
      id: row.id,
      slug: row.slug,
      revision: row.revision,
      enabled: row.enabled,
    };
    await tx.insert(catalogPlans).values({
      id: key,
      actorId,
      kind: "editor",
      digest,
      payload: {},
      expiresAt: new Date(Date.now() + 86400000),
      result: {
        created: id ? 0 : 1,
        updated: id ? 1 : 0,
        skipped: 0,
        unchanged: 0,
        affected: [affected],
      },
    });
    return { ...affected, replayed: false };
  });
}
