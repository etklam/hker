import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/server/db'
import { collectionInviteLinks, collectionMembers } from '@/db/schema/collaboration'
import { collections } from '@/db/schema/collections'
import { AppError } from '@/lib/errors'

function generateToken(): string {
  return randomBytes(48).toString('base64url').slice(0, 64)
}

export async function listForCollection(collectionId: number) {
  return db
    .select()
    .from(collectionInviteLinks)
    .where(eq(collectionInviteLinks.collectionId, collectionId))
}

export async function create(
  collectionId: number,
  createdBy: number,
  data: { role: 'viewer' | 'editor'; maxUses?: number; expiresInHours?: number },
) {
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 3600_000)
    : null

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db
        .insert(collectionInviteLinks)
        .values({
          collectionId,
          token: generateToken(),
          role: data.role,
          createdBy,
          maxUses: data.maxUses ?? null,
          useCount: 0,
          expiresAt,
        })
        .returning()
      return row
    } catch (e: unknown) {
      const isUniqueViolation =
        e instanceof Error && 'code' in e && (e as { code: string }).code === '23505'
      if (!isUniqueViolation || attempt === 4) throw e
    }
  }

  throw new AppError('INTERNAL_ERROR', 'Failed to generate unique invite token')
}

export async function remove(inviteId: number) {
  await db
    .delete(collectionInviteLinks)
    .where(eq(collectionInviteLinks.id, inviteId))
}

export async function getByToken(token: string) {
  const [row] = await db
    .select({
      id: collectionInviteLinks.id,
      collectionId: collectionInviteLinks.collectionId,
      token: collectionInviteLinks.token,
      role: collectionInviteLinks.role,
      maxUses: collectionInviteLinks.maxUses,
      useCount: collectionInviteLinks.useCount,
      expiresAt: collectionInviteLinks.expiresAt,
      createdAt: collectionInviteLinks.createdAt,
      collectionTitle: collections.title,
      collectionDescription: collections.description,
      collectionIcon: collections.icon,
      collectionVisibility: collections.visibility,
      collectionOwnerId: collections.ownerId,
    })
    .from(collectionInviteLinks)
    .innerJoin(collections, eq(collectionInviteLinks.collectionId, collections.id))
    .where(eq(collectionInviteLinks.token, token))
    .limit(1)

  return row ?? null
}

function isInviteValid(invite: {
  expiresAt: Date | null
  maxUses: number | null
  useCount: number
}): boolean {
  if (invite.expiresAt && new Date() > invite.expiresAt) return false
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return false
  return true
}

export async function joinCollection(token: string, userId: number) {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(collectionInviteLinks)
      .where(eq(collectionInviteLinks.token, token))
      .for('update')

    if (!invite) {
      throw new AppError('NOT_FOUND', 'Invite not found')
    }

    if (!isInviteValid(invite)) {
      throw new AppError('INVALID_REQUEST', 'This invite is no longer valid')
    }

    const [collection] = await tx
      .select()
      .from(collections)
      .where(eq(collections.id, invite.collectionId))
      .limit(1)

    if (!collection) {
      throw new AppError('NOT_FOUND', 'Collection not found')
    }

    // Owner doesn't need to join
    if (collection.ownerId === userId) {
      return { collection, role: 'owner' as const, alreadyMember: true }
    }

    // Check existing membership
    const [existing] = await tx
      .select()
      .from(collectionMembers)
      .where(
        sql`${collectionMembers.collectionId} = ${invite.collectionId} AND ${collectionMembers.userId} = ${userId}`,
      )
      .limit(1)

    if (existing) {
      return { collection, role: existing.role, alreadyMember: true }
    }

    // Insert new member
    await tx.insert(collectionMembers).values({
      collectionId: invite.collectionId,
      userId,
      role: invite.role,
    })

    // Increment use count
    await tx
      .update(collectionInviteLinks)
      .set({ useCount: sql`${collectionInviteLinks.useCount} + 1` })
      .where(eq(collectionInviteLinks.id, invite.id))

    return { collection, role: invite.role, alreadyMember: false }
  })
}

export { isInviteValid }
