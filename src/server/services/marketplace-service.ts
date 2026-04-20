import { eq, desc, asc, sql, or, ilike, count } from 'drizzle-orm'
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

function toListingDto(row: Record<string, unknown>): MarketplaceListing {
  const r = row as {
    listingId: number
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

  return {
    id: r.listingId,
    collection: {
      id: r.collectionId,
      title: r.collectionTitle,
      description: r.collectionDescription,
      icon: r.collectionIcon,
      visibility: r.collectionVisibility,
      sortOrder: r.collectionSortOrder,
      linkCount: r.linkCount,
      access: 'none',
      createdAt: r.collectionCreatedAt.toISOString(),
      updatedAt: r.collectionUpdatedAt.toISOString(),
    },
    publisher: maskPublisher(r),
    publishedAt: r.publishedAt.toISOString(),
    subscriberCount: r.subscriberCount,
    forkCount: r.forkCount,
  }
}

const listingSelect = {
  listingId: marketplaceListings.id,
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
      ? [desc(marketplaceListings.subscriberCount), desc(marketplaceListings.publishedAt)]
      : [desc(marketplaceListings.publishedAt)]

  const [rows, [{ total }]] = await Promise.all([
    baseQuery()
      .orderBy(...orderBy)
      .limit(size)
      .offset(page * size),
    baseCountQuery(),
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

  const whereClause = or(
    ilike(collections.title, pattern),
    ilike(collections.description, pattern),
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
  const rows = await baseQuery().where(eq(marketplaceListings.id, listingId)).limit(1)

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

  const [listing] = await db
    .insert(marketplaceListings)
    .values({
      collectionId,
      publisherId,
      publisherAnonymous: anonymous,
    })
    .onConflictDoUpdate({
      target: marketplaceListings.collectionId,
      set: {
        publisherAnonymous: anonymous,
        publishedAt: new Date(),
      },
    })
    .returning()

  const rows = await baseQuery().where(eq(marketplaceListings.id, listing.id)).limit(1)
  return toListingDto(rows[0])
}

export async function unpublish(collectionId: number): Promise<void> {
  const [deleted] = await db
    .delete(marketplaceListings)
    .where(eq(marketplaceListings.collectionId, collectionId))
    .returning()

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Listing not found')
  }

  await db
    .update(collections)
    .set({ visibility: 'unlisted', updatedAt: new Date() })
    .where(eq(collections.id, collectionId))
}
