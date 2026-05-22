import { eq, desc, asc, sql, or, ilike, count, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { marketplaceListings } from '@/db/schema/marketplace'
import { collections, links } from '@/db/schema/collections'
import { users } from '@/db/schema/users'
import { AppError } from '@/lib/errors'
import type { MarketplaceListing, MarketplaceDetail, PageResponse, Link } from '@/lib/types'

function maskPublisher(row: {
  publisherId: number
  publisherAnonymous: boolean
  publisherDisplayName: string | null
  publisherAvatarUrl: string | null
}): MarketplaceListing['publisher'] {
  if (row.publisherAnonymous) return null
  return {
    id: row.publisherId,
    displayName: row.publisherDisplayName,
    avatarUrl: row.publisherAvatarUrl,
  }
}

interface ListingRow {
  listingId: number
  listingTitle: string
  listingDescription: string | null
  collectionId: number
  collectionTitle: string
  collectionDescription: string | null
  collectionIcon: string | null
  collectionVisibility: 'private' | 'unlisted' | 'public'
  collectionSortOrder: number
  collectionCreatedAt: Date
  collectionUpdatedAt: Date
  publisherId: number
  publisherAnonymous: boolean
  publisherDisplayName: string | null
  publisherAvatarUrl: string | null
  publishedAt: Date
  subscriberCount: number
  forkCount: number
  linkCount: number
}

function toListingDto(row: ListingRow): MarketplaceListing {
  return {
    id: row.listingId,
    title: row.listingTitle,
    description: row.listingDescription,
    collection: {
      id: row.collectionId,
      title: row.collectionTitle,
      description: row.collectionDescription,
      icon: row.collectionIcon,
      visibility: row.collectionVisibility,
      sortOrder: row.collectionSortOrder,
      linkCount: row.linkCount,
      access: 'none',
      createdAt: row.collectionCreatedAt.toISOString(),
      updatedAt: row.collectionUpdatedAt.toISOString(),
    },
    publisher: maskPublisher(row),
    publishedAt: row.publishedAt.toISOString(),
    subscriberCount: row.subscriberCount,
    forkCount: row.forkCount,
  }
}

const listingSelect = {
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
}

function baseQuery() {
  return db
    .select(listingSelect)
    .from(marketplaceListings)
    .innerJoin(collections, eq(marketplaceListings.collectionId, collections.id))
    .innerJoin(users, eq(marketplaceListings.publisherId, users.id))
}

function baseCountQuery() {
  return db
    .select({ total: count() })
    .from(marketplaceListings)
    .innerJoin(collections, eq(marketplaceListings.collectionId, collections.id))
}

export async function listListings(
  page: number,
  size: number,
  sort: 'newest' | 'most_subscribed',
): Promise<PageResponse<MarketplaceListing>> {
  const orderBy =
    sort === 'most_subscribed'
      ? [desc(marketplaceListings.pinned), desc(marketplaceListings.subscriberCount), desc(marketplaceListings.publishedAt)]
      : [desc(marketplaceListings.pinned), desc(marketplaceListings.publishedAt)]

  const [rows, [{ total }]] = await Promise.all([
    baseQuery()
      .where(eq(marketplaceListings.active, true))
      .orderBy(...orderBy)
      .limit(size)
      .offset(page * size),
    baseCountQuery().where(eq(marketplaceListings.active, true)),
  ])

  return {
    content: rows.map(toListingDto),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
  }
}

export async function searchListings(
  query: string,
  page: number,
  size: number,
): Promise<PageResponse<MarketplaceListing>> {
  const pattern = `%${query}%`

  const whereClause = and(
    eq(marketplaceListings.active, true),
    or(
      ilike(marketplaceListings.title, pattern),
      ilike(marketplaceListings.description, pattern),
    ),
  )

  const [rows, countResult] = await Promise.all([
    baseQuery()
      .where(whereClause)
      .orderBy(desc(marketplaceListings.publishedAt))
      .limit(size)
      .offset(page * size),
    baseCountQuery()
      .where(whereClause),
  ])

  const total = countResult[0].total

  return {
    content: rows.map(toListingDto),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
  }
}

export async function getDetail(listingId: number): Promise<MarketplaceDetail> {
  const rows = await baseQuery()
    .where(and(eq(marketplaceListings.id, listingId), eq(marketplaceListings.active, true)))
    .limit(1)

  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Listing not found')
  }

  const listing = toListingDto(rows[0])

  const linkRows = await db
    .select()
    .from(links)
    .where(eq(links.collectionId, listing.collection.id))
    .orderBy(asc(links.sortOrder))

  const listingLinks: Link[] = linkRows.map((l) => ({
    id: l.id,
    collectionId: l.collectionId,
    title: l.title,
    url: l.url,
    description: l.description,
    faviconUrl: l.faviconUrl,
    sortOrder: l.sortOrder,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }))

  return { listing, links: listingLinks }
}

export async function publish(
  collectionId: number,
  publisherId: number,
  anonymous: boolean,
): Promise<MarketplaceListing> {
  await db
    .update(collections)
    .set({ visibility: 'public', updatedAt: new Date() })
    .where(eq(collections.id, collectionId))

  // Fetch collection to pre-fill title and description
  const collection = await db
    .select({ title: collections.title, description: collections.description })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1)

  if (!collection[0]) {
    throw new AppError('NOT_FOUND', 'Collection not found')
  }

  const { title, description } = collection[0]

  // Try to reactivate an existing inactive listing first
  const reactivated = await reactivate(collectionId)

  let listing: { id: number }

  if (reactivated) {
    // Update the reactivated listing with new publisher settings
    // Do NOT reset title/description from collection on re-publish
    const [updated] = await db
      .update(marketplaceListings)
      .set({
        publisherId,
        publisherAnonymous: anonymous,
      })
      .where(eq(marketplaceListings.collectionId, collectionId))
      .returning()
    listing = updated!
  } else {
    // Create new listing or update existing active one
    const [inserted] = await db
      .insert(marketplaceListings)
      .values({
        collectionId,
        publisherId,
        title,
        description,
        publisherAnonymous: anonymous,
        active: true,
      })
      .onConflictDoUpdate({
        target: marketplaceListings.collectionId,
        set: {
          publisherAnonymous: anonymous,
          publishedAt: new Date(),
          active: true,
        },
      })
      .returning()
    listing = inserted!
  }

  const rows = await baseQuery()
    .where(and(eq(marketplaceListings.id, listing.id), eq(marketplaceListings.active, true)))
    .limit(1)
  return toListingDto(rows[0])
}

export async function unpublish(collectionId: number): Promise<void> {
  const [updated] = await db
    .update(marketplaceListings)
    .set({ active: false })
    .where(eq(marketplaceListings.collectionId, collectionId))
    .returning()

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Listing not found')
  }

  await db
    .update(collections)
    .set({ visibility: 'unlisted', updatedAt: new Date() })
    .where(eq(collections.id, collectionId))
}

/**
 * Soft-unpublish a marketplace listing by setting active = false.
 * This is called automatically when collection visibility is downgraded.
 * Gracefully handles cases where no listing exists (no-op).
 */
export async function softUnpublish(collectionId: number): Promise<void> {
  await db
    .update(marketplaceListings)
    .set({ active: false })
    .where(eq(marketplaceListings.collectionId, collectionId))
}

/**
 * Reactivate a previously soft-unpublished listing.
 * Returns true if a listing was reactivated, false if no inactive listing exists.
 */
export async function reactivate(collectionId: number): Promise<boolean> {
  const [updated] = await db
    .update(marketplaceListings)
    .set({ active: true, publishedAt: new Date() })
    .where(and(eq(marketplaceListings.collectionId, collectionId), eq(marketplaceListings.active, false)))
    .returning()

  return !!updated
}

/**
 * Update a marketplace listing's independent title and/or description.
 * Only the provided fields are updated; null/undefined values are ignored.
 */
export async function updateListing(
  listingId: number,
  data: { title?: string; description?: string },
): Promise<MarketplaceListing> {
  const set: Record<string, unknown> = {}
  if (data.title !== undefined) set.title = data.title
  if (data.description !== undefined) set.description = data.description

  if (Object.keys(set).length === 0) {
    throw new AppError('INVALID_REQUEST', 'No fields to update')
  }

  const [updated] = await db
    .update(marketplaceListings)
    .set(set)
    .where(eq(marketplaceListings.id, listingId))
    .returning({ id: marketplaceListings.id })

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Listing not found')
  }

  const rows = await baseQuery()
    .where(and(eq(marketplaceListings.id, updated.id), eq(marketplaceListings.active, true)))
    .limit(1)

  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Listing not found')
  }

  return toListingDto(rows[0])
}
