import { eq, sql, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/server/db'
import {
  spaces,
  spaceMembers,
  spaceInviteLinks,
} from '@/db/schema/space'
import { users } from '@/db/schema/users'
import { AppError } from '@/lib/errors'

function generateToken(): string {
  return randomBytes(48).toString('base64url').slice(0, 64)
}

export async function listForUser(userId: number) {
  const ownedSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      ownerId: spaces.ownerId,
      role: sql<string>`'owner'`,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(eq(spaces.ownerId, userId))

  const memberSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      ownerId: spaces.ownerId,
      role: spaceMembers.role,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaceMembers.spaceId, spaces.id))
    .where(
      and(
        eq(spaceMembers.userId, userId),
        sql`${spaces.ownerId} != ${userId}`,
      ),
    )

  const all = [...ownedSpaces, ...memberSpaces]
  return all.map((s) => ({
    id: s.id,
    name: s.name,
    ownerId: s.ownerId,
    role: s.role,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))
}

export async function getById(spaceId: number) {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1)
  return space ?? null
}

export async function create(userId: number, name: string) {
  const [space] = await db
    .insert(spaces)
    .values({ name, ownerId: userId })
    .returning()

  await db.insert(spaceMembers).values({
    spaceId: space.id,
    userId,
    role: 'owner',
  })

  return {
    id: space.id,
    name: space.name,
    ownerId: space.ownerId,
    role: 'owner',
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
  }
}

export async function update(spaceId: number, data: { name?: string }) {
  const values: { name?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (data.name !== undefined) values.name = data.name

  const [updated] = await db
    .update(spaces)
    .set(values)
    .where(eq(spaces.id, spaceId))
    .returning()

  return updated ?? null
}

export async function remove(spaceId: number) {
  await db.delete(spaces).where(eq(spaces.id, spaceId))
}

export async function listMembers(spaceId: number) {
  const rows = await db
    .select({
      id: spaceMembers.id,
      userId: spaceMembers.userId,
      role: spaceMembers.role,
      joinedAt: spaceMembers.joinedAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      email: users.email,
    })
    .from(spaceMembers)
    .innerJoin(users, eq(spaceMembers.userId, users.id))
    .where(eq(spaceMembers.spaceId, spaceId))

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

export async function removeMember(spaceId: number, memberId: number) {
  const [row] = await db
    .delete(spaceMembers)
    .where(and(eq(spaceMembers.id, memberId), eq(spaceMembers.spaceId, spaceId)))
    .returning()
  return row ?? null
}

export async function createInvite(
  spaceId: number,
  createdBy: number,
  data: { maxUses?: number; expiresInHours?: number },
) {
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 3600_000)
    : null

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db
        .insert(spaceInviteLinks)
        .values({
          spaceId,
          token: generateToken(),
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

export async function listInvites(spaceId: number) {
  return db
    .select()
    .from(spaceInviteLinks)
    .where(eq(spaceInviteLinks.spaceId, spaceId))
}

export async function deleteInvite(spaceId: number, inviteId: number) {
  const [row] = await db
    .delete(spaceInviteLinks)
    .where(and(eq(spaceInviteLinks.id, inviteId), eq(spaceInviteLinks.spaceId, spaceId)))
    .returning()
  return row ?? null
}

export async function getInviteByToken(token: string) {
  const [row] = await db
    .select({
      id: spaceInviteLinks.id,
      spaceId: spaceInviteLinks.spaceId,
      token: spaceInviteLinks.token,
      maxUses: spaceInviteLinks.maxUses,
      useCount: spaceInviteLinks.useCount,
      expiresAt: spaceInviteLinks.expiresAt,
      createdAt: spaceInviteLinks.createdAt,
      spaceName: spaces.name,
      spaceOwnerId: spaces.ownerId,
      spaceCreatedAt: spaces.createdAt,
      spaceUpdatedAt: spaces.updatedAt,
    })
    .from(spaceInviteLinks)
    .innerJoin(spaces, eq(spaceInviteLinks.spaceId, spaces.id))
    .where(eq(spaceInviteLinks.token, token))
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

export async function joinSpace(token: string, userId: number) {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(spaceInviteLinks)
      .where(eq(spaceInviteLinks.token, token))
      .for('update')

    if (!invite) {
      throw new AppError('NOT_FOUND', 'Invite not found')
    }

    if (!isInviteValid(invite)) {
      throw new AppError('INVALID_REQUEST', 'This invite is no longer valid')
    }

    const [space] = await tx
      .select()
      .from(spaces)
      .where(eq(spaces.id, invite.spaceId))
      .limit(1)

    if (!space) {
      throw new AppError('NOT_FOUND', 'Space not found')
    }

    if (space.ownerId === userId) {
      return { space, role: 'owner' as const, alreadyMember: true }
    }

    const [existing] = await tx
      .select()
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, invite.spaceId),
          eq(spaceMembers.userId, userId),
        ),
      )
      .limit(1)

    if (existing) {
      return { space, role: existing.role, alreadyMember: true }
    }

    await tx.insert(spaceMembers).values({
      spaceId: invite.spaceId,
      userId,
      role: 'member',
    })

    await tx
      .update(spaceInviteLinks)
      .set({ useCount: sql`${spaceInviteLinks.useCount} + 1` })
      .where(eq(spaceInviteLinks.id, invite.id))

    return { space, role: 'member' as const, alreadyMember: false }
  })
}

export { isInviteValid }
