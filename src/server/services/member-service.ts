import { eq, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { collectionMembers } from '@/db/schema/collaboration'
import { users } from '@/db/schema/users'

export async function listForCollection(collectionId: number) {
  const rows = await db
    .select({
      id: collectionMembers.id,
      userId: collectionMembers.userId,
      role: collectionMembers.role,
      joinedAt: collectionMembers.joinedAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      email: users.email,
    })
    .from(collectionMembers)
    .innerJoin(users, eq(collectionMembers.userId, users.id))
    .where(eq(collectionMembers.collectionId, collectionId))

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    email: r.email,
  }))
}

export async function updateRole(collectionId: number, memberId: number, role: 'viewer' | 'editor') {
  const [row] = await db
    .update(collectionMembers)
    .set({ role })
    .where(and(eq(collectionMembers.id, memberId), eq(collectionMembers.collectionId, collectionId)))
    .returning()
  return row ?? null
}

export async function remove(collectionId: number, memberId: number) {
  const [row] = await db
    .delete(collectionMembers)
    .where(and(eq(collectionMembers.id, memberId), eq(collectionMembers.collectionId, collectionId)))
    .returning()
  return row ?? null
}
