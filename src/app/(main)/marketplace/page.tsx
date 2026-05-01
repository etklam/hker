import { Metadata } from 'next'
import { db } from '@/server/db'
import { marketplaceListings } from '@/db/schema/marketplace'
import { collections } from '@/db/schema/collections'
import { users } from '@/db/schema/users'
import { eq, desc, sql, ilike, or, count } from 'drizzle-orm'
import type { MarketplaceListing, PageResponse } from '@/lib/types'
import { MarketplaceClientView } from './MarketplaceClientView'

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

interface ListingRow {
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

function toListingDto(row: ListingRow): MarketplaceListing {
  return {
    id: row.listingId,
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
    publisher: row.publisherAnonymous
      ? null
      : { id: row.publisherId, displayName: row.publisherDisplayName, avatarUrl: row.publisherAvatarUrl },
    publishedAt: row.publishedAt.toISOString(),
    subscriberCount: row.subscriberCount,
    forkCount: row.forkCount,
  }
}

export const metadata: Metadata = {
  title: 'Marketplace — HKER',
  description: 'Explore public collections, subscribe for updates or fork your own version.',
  openGraph: {
    title: 'Marketplace — HKER',
    description: 'Explore public collections, subscribe for updates or fork your own version.',
  },
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; sort?: string; q?: string }>
}) {
  const params = await searchParams
  const page = Math.max(0, Number(params.page ?? '0'))
  const size = Math.min(100, Math.max(1, Number(params.size ?? '20')))
  const sort = params.sort === 'most_subscribed' ? 'most_subscribed' : 'newest'
  const q = params.q?.trim() || ''

  let total: number
  let content: MarketplaceListing[]

  if (q) {
    const pattern = `%${q}%`
    const whereClause = or(
      ilike(collections.title, pattern),
      ilike(collections.description, pattern),
    )

    const [dataRows, countResult] = await Promise.all([
      baseQuery()
        .where(whereClause)
        .orderBy(desc(marketplaceListings.publishedAt))
        .limit(size)
        .offset(page * size),
      db
        .select({ total: count() })
        .from(marketplaceListings)
        .innerJoin(collections, eq(marketplaceListings.collectionId, collections.id))
        .where(whereClause),
    ])

    content = dataRows.map(toListingDto)
    total = countResult[0].total
  } else {
    const orderBy =
      sort === 'most_subscribed'
        ? [desc(marketplaceListings.subscriberCount), desc(marketplaceListings.publishedAt)]
        : [desc(marketplaceListings.publishedAt)]

    const [dataRows, countResult] = await Promise.all([
      baseQuery()
        .orderBy(...orderBy)
        .limit(size)
        .offset(page * size),
      db.select({ total: count() }).from(marketplaceListings),
    ])

    content = dataRows.map(toListingDto)
    total = countResult[0].total
  }

  const data: PageResponse<MarketplaceListing> = {
    content,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
  }

  return <MarketplaceClientView initialData={data} initialQuery={q} initialSort={sort} />
}
