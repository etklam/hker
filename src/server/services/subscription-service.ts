import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { subscriptions, marketplaceListings, forks } from '@/db/schema/marketplace'
import { collections, links } from '@/db/schema/collections'
import { users } from '@/db/schema/users'
import { AppError } from '@/lib/errors'
import type { MarketplaceListing } from '@/lib/types'

export async function subscribe(userId: number, listingId: number): Promise<void> {
  const [listing] = await db
    .select({ id: marketplaceListings.id, publisherId: marketplaceListings.publisherId })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.id, listingId))
    .limit(1)

  if (!listing) throw new AppError('NOT_FOUND', 'Listing not found')
  if (listing.publisherId === userId) throw new AppError('INVALID_REQUEST', 'Cannot subscribe to your own listing')

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.listingId, listingId)))
      .limit(1)

    if (existing) return // idempotent

    await tx.insert(subscriptions).values({ userId, listingId })

    await tx
      .update(marketplaceListings)
      .set({ subscriberCount: sql`${marketplaceListings.subscriberCount} + 1` })
      .where(eq(marketplaceListings.id, listingId))
  })
}

export async function unsubscribe(userId: number, listingId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.listingId, listingId)))
      .returning()

    if (!deleted) return // nothing to unsubscribe

    await tx
      .update(marketplaceListings)
      .set({
        subscriberCount: sql`GREATEST(${marketplaceListings.subscriberCount} - 1, 0)`,
      })
      .where(eq(marketplaceListings.id, listingId))
  })
}

export async function listUserSubscriptions(userId: number): Promise<MarketplaceListing[]> {
  const rows = await db
    .select({
      listingId: marketplaceListings.id,
      listingTitle: marketplaceListings.title,
      listingDescription: marketplaceListings.description,
      collectionId: collections.id,
      collectionTitle: collections.title,
      collectionDescription: collections.description,
      collectionIcon: collections.icon,
      collectionVisibility: collections.visibility,
      collectionSortOrder: collections.sortOrder,
      collectionCreatedAt: collections.createdAt,
      collectionUpdatedAt: collections.updatedAt,
      publisherId: marketplaceListings.publisherId,
      publisherAnonymous: marketplaceListings.publisherAnonymous,
      publisherDisplayName: users.displayName,
      publisherAvatarUrl: users.avatarUrl,
      publishedAt: marketplaceListings.publishedAt,
      subscriberCount: marketplaceListings.subscriberCount,
      forkCount: marketplaceListings.forkCount,
      linkCount: sql<number>`(SELECT count(*)::int FROM links WHERE links.collection_id = ${collections.id})`,
    })
    .from(subscriptions)
    .innerJoin(marketplaceListings, eq(subscriptions.listingId, marketplaceListings.id))
    .innerJoin(collections, eq(marketplaceListings.collectionId, collections.id))
    .innerJoin(users, eq(marketplaceListings.publisherId, users.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(subscriptions.createdAt)

  return rows.map((r) => ({
    id: r.listingId,
    title: r.listingTitle,
    description: r.listingDescription,
    collection: {
      id: r.collectionId,
      title: r.collectionTitle,
      description: r.collectionDescription,
      icon: r.collectionIcon,
      visibility: r.collectionVisibility,
      sortOrder: r.collectionSortOrder,
      linkCount: r.linkCount,
      access: 'none' as const,
      createdAt: r.collectionCreatedAt.toISOString(),
      updatedAt: r.collectionUpdatedAt.toISOString(),
    },
    publisher: r.publisherAnonymous
      ? null
      : { id: r.publisherId, displayName: r.publisherDisplayName, avatarUrl: r.publisherAvatarUrl },
    publishedAt: r.publishedAt.toISOString(),
    subscriberCount: r.subscriberCount,
    forkCount: r.forkCount,
  }))
}

export async function isSubscribed(userId: number, listingId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.listingId, listingId)))
    .limit(1)

  return !!row
}

export async function fork(userId: number, listingId: number): Promise<{ collectionId: number }> {
  const [listing] = await db
    .select({
      id: marketplaceListings.id,
      collectionId: marketplaceListings.collectionId,
      publisherId: marketplaceListings.publisherId,
    })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.id, listingId))
    .limit(1)

  if (!listing) throw new AppError('NOT_FOUND', 'Listing not found')
  if (listing.publisherId === userId) throw new AppError('INVALID_REQUEST', 'Cannot fork your own listing')

  // Check for duplicate fork
  const [existingFork] = await db
    .select({ id: forks.id })
    .from(forks)
    .where(and(eq(forks.sourceCollectionId, listing.collectionId), eq(forks.forkedBy, userId)))
    .limit(1)

  if (existingFork) throw new AppError('CONFLICT', 'You have already forked this collection')

  // Get source collection and links
  const [sourceCollection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, listing.collectionId))
    .limit(1)

  if (!sourceCollection) throw new AppError('NOT_FOUND', 'Source collection not found')

  const sourceLinks = await db
    .select()
    .from(links)
    .where(eq(links.collectionId, listing.collectionId))

  const result = await db.transaction(async (tx) => {
    // Create new collection
    const [newCollection] = await tx
      .insert(collections)
      .values({
        ownerId: userId,
        title: sourceCollection.title,
        description: sourceCollection.description,
        icon: sourceCollection.icon,
        visibility: 'private',
      })
      .returning()

    // Copy links
    if (sourceLinks.length > 0) {
      await tx.insert(links).values(
        sourceLinks.map((l) => ({
          collectionId: newCollection.id,
          title: l.title,
          url: l.url,
          description: l.description,
          faviconUrl: l.faviconUrl,
          sortOrder: l.sortOrder,
        })),
      )
    }

    // Record fork
    await tx.insert(forks).values({
      sourceCollectionId: listing.collectionId,
      forkedCollectionId: newCollection.id,
      forkedBy: userId,
    })

    // Increment fork count
    await tx
      .update(marketplaceListings)
      .set({ forkCount: sql`${marketplaceListings.forkCount} + 1` })
      .where(eq(marketplaceListings.id, listingId))

    return { collectionId: newCollection.id }
  })

  return result
}
