import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { catalogHistory } from "@/db/schema/directoryOperations";
import { db } from "@/server/db";
import type { CatalogExecutor } from "./service";
export type MutationContext = { actorId?: number; operationId?: string };
export function contentDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(
        (key) =>
          !["id", "createdAt", "updatedAt", "revision"].includes(key) &&
          JSON.stringify(before[key] ?? null) !==
            JSON.stringify(after[key] ?? null),
      )
      .map((key) => [
        key,
        { before: before[key] ?? null, after: after[key] ?? null },
      ]),
  );
}
export async function recordContentChange(
  tx: CatalogExecutor,
  entity: string,
  entityId: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  context: MutationContext = {},
) {
  const changes = contentDiff(before, after);
  if (!Object.keys(changes).length) return;
  // Keep each value bounded; this is an investigation aid, not a restore snapshot.
  const bounded = (value: unknown): unknown =>
    JSON.stringify(value).length > 2000
      ? { truncated: true, excerpt: JSON.stringify(value).slice(0, 2000) }
      : value;
  await tx.insert(catalogHistory).values({
    id: randomUUID(),
    actorId: context.actorId,
    entity,
    entityId,
    action: !Object.keys(after).length
      ? "delete"
      : !Object.keys(before).length
        ? "create"
        : "enabled" in changes
          ? after.enabled
            ? "publish"
            : "unpublish"
          : "update",
    beforeRevision:
      typeof before.revision === "number" ? before.revision : null,
    afterRevision: typeof after.revision === "number" ? after.revision : null,
    operationId: context.operationId,
    changes: Object.fromEntries(
      Object.entries(changes).map(([key, change]) => [
        key,
        { before: bounded(change.before), after: bounded(change.after) },
      ]),
    ),
  });
}
export async function contentHistory(entityId?: number) {
  return db
    .select()
    .from(catalogHistory)
    .where(
      entityId
        ? and(
            eq(catalogHistory.entity, "listing"),
            eq(catalogHistory.entityId, entityId),
          )
        : undefined,
    )
    .orderBy(desc(catalogHistory.createdAt), desc(catalogHistory.id))
    .limit(100);
}
