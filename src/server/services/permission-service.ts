import { eq, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { collections } from '@/db/schema/collections'
import { collectionMembers } from '@/db/schema/collaboration'
import { spaces, spaceMembers } from '@/db/schema/space'
import { AppError } from '@/lib/errors'

export type CollectionAccess = 'none' | 'view' | 'edit' | 'owner'
export type SpaceAccess = 'none' | 'member' | 'admin' | 'owner'

const COLLECTION_ACCESS_LEVELS: Record<CollectionAccess, number> = {
  none: 0,
  view: 1,
  edit: 2,
  owner: 3,
}

const SPACE_ACCESS_LEVELS: Record<SpaceAccess, number> = {
  none: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

export async function getCollectionAccess(
  userId: number | null,
  collectionId: number,
): Promise<CollectionAccess> {
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1)

  if (!collection) return 'none'

  if (userId !== null && collection.ownerId === userId) return 'owner'

  if (userId !== null) {
    const [membership] = await db
      .select()
      .from(collectionMembers)
      .where(
        and(
          eq(collectionMembers.collectionId, collectionId),
          eq(collectionMembers.userId, userId),
        ),
      )
      .limit(1)

    if (membership) {
      return membership.role === 'editor' ? 'edit' : 'view'
    }
  }

  if (collection.visibility === 'public' || collection.visibility === 'unlisted') {
    return 'view'
  }

  return 'none'
}

export async function getSpaceAccess(
  userId: number,
  spaceId: number,
): Promise<SpaceAccess> {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1)

  if (!space) return 'none'

  if (space.ownerId === userId) return 'owner'

  const [membership] = await db
    .select()
    .from(spaceMembers)
    .where(
      and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
      ),
    )
    .limit(1)

  if (!membership) return 'none'

  return membership.role === 'admin' ? 'admin' : 'member'
}

export function requireAtLeast(actual: CollectionAccess, required: CollectionAccess): void {
  if (COLLECTION_ACCESS_LEVELS[actual] < COLLECTION_ACCESS_LEVELS[required]) {
    throw new AppError('FORBIDDEN', 'Insufficient collection access')
  }
}

export function requireSpaceAtLeast(actual: SpaceAccess, required: SpaceAccess): void {
  if (SPACE_ACCESS_LEVELS[actual] < SPACE_ACCESS_LEVELS[required]) {
    throw new AppError('FORBIDDEN', 'Insufficient space access')
  }
}

export type UserRole = 'user' | 'admin' | 'superadmin'

export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'superadmin'
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'superadmin'
}
