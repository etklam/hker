import { eq, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { collections } from '@/db/schema/collections'
import { links } from '@/db/schema/collections'
import { collectionMembers } from '@/db/schema/collaboration'
import * as marketplaceService from './marketplace-service'

export async function listForUser(userId: number) {
  const ownedRows = await db
    .select({
      id: collections.id,
      ownerId: collections.ownerId,
      title: collections.title,
      description: collections.description,
      icon: collections.icon,
      visibility: collections.visibility,
      sortOrder: collections.sortOrder,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      memberRole: sql<string | null>`null`,
    })
    .from(collections)
    .where(eq(collections.ownerId, userId))

  const memberRows = await db
    .select({
      id: collections.id,
      ownerId: collections.ownerId,
      title: collections.title,
      description: collections.description,
      icon: collections.icon,
      visibility: collections.visibility,
      sortOrder: collections.sortOrder,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      memberRole: collectionMembers.role,
    })
    .from(collectionMembers)
    .innerJoin(collections, eq(collectionMembers.collectionId, collections.id))
    .where(eq(collectionMembers.userId, userId))

  const allRows = [...ownedRows, ...memberRows]

  const collectionIds = allRows.map((r) => r.id)
  const linkCounts = new Map<number, number>()

  if (collectionIds.length > 0) {
    const counts = await db
      .select({
        collectionId: links.collectionId,
        count: sql<number>`count(*)::int`,
      })
      .from(links)
      .where(sql`${links.collectionId} = ANY(${collectionIds})`)
      .groupBy(links.collectionId)

    for (const row of counts) {
      linkCounts.set(row.collectionId, row.count)
    }
  }

  const result = allRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    visibility: row.visibility as 'private' | 'unlisted' | 'public',
    sortOrder: row.sortOrder,
    linkCount: linkCounts.get(row.id) ?? 0,
    access: row.ownerId === userId
      ? 'owner' as const
      : row.memberRole === 'editor'
        ? 'editor' as const
        : 'viewer' as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))

  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return result
}

export async function getById(id: number) {
  const [row] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1)
  return row ?? null
}

export async function create(
  userId: number,
  data: { title: string; description?: string; icon?: string },
) {
  const [row] = await db
    .insert(collections)
    .values({
      ownerId: userId,
      title: data.title,
      description: data.description ?? null,
      icon: data.icon ?? null,
      visibility: 'private',
      sortOrder: 0,
    })
    .returning()
  return row
}

export async function update(
  id: number,
  data: { title?: string; description?: string; icon?: string; sortOrder?: number },
) {
  const [row] = await db
    .update(collections)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, id))
    .returning()
  return row ?? null
}

export async function updateVisibility(
  id: number,
  visibility: 'private' | 'unlisted' | 'public',
) {
  const [row] = await db
    .update(collections)
    .set({ visibility, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning()

  if (!row) return null

  // Auto-unpublish marketplace listing when visibility is downgraded from public
  if (visibility === 'private' || visibility === 'unlisted') {
    // softUnpublish handles cases where no listing exists gracefully (no-op)
    await marketplaceService.softUnpublish(id)
  }

  return row
}

export async function remove(id: number) {
  await db.delete(collections).where(eq(collections.id, id))
}
