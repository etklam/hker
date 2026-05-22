import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { marketplaceListings } from '@/db/schema/marketplace'
import { collections, links } from '@/db/schema/collections'
import { users } from '@/db/schema/users'
import { eq, asc, sql } from 'drizzle-orm'
import { ExternalLink } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import type { MarketplaceListing, Link as LinkType } from '@/lib/types'
import { MarketplaceDetailClient } from './MarketplaceDetailClient'

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
    publisher: row.publisherAnonymous
      ? null
      : { id: row.publisherId, displayName: row.publisherDisplayName, avatarUrl: row.publisherAvatarUrl },
    publishedAt: row.publishedAt.toISOString(),
    subscriberCount: row.subscriberCount,
    forkCount: row.forkCount,
  }
}

async function fetchListing(listingId: number) {
  const rows = await baseQuery().where(eq(marketplaceListings.id, listingId)).limit(1)
  if (rows.length === 0) return null
  return toListingDto(rows[0])
}

async function fetchLinks(collectionId: number): Promise<LinkType[]> {
  const rows = await db
    .select()
    .from(links)
    .where(eq(links.collectionId, collectionId))
    .orderBy(asc(links.sortOrder))

  return rows.map((l) => ({
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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ listingId: string }>
}): Promise<Metadata> {
  const { listingId } = await params
  const listing = await fetchListing(Number(listingId))
  if (!listing) return { title: 'Not Found — HKER' }

  const title = `${listing.title} — HKER Marketplace`
  const description =
    listing.description || 'Explore this collection on HKER Marketplace.'

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params
  const id = Number(listingId)
  if (!id || isNaN(id)) notFound()

  const listing = await fetchListing(id)
  if (!listing) notFound()

  const listingLinks = await fetchLinks(listing.collection.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      {/* Hero header */}
      <section className="relative mb-10">
        <div className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="flex items-start gap-5">
          {listing.collection.icon ? (
            <span className="text-5xl leading-none">{listing.collection.icon}</span>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent">
              {listing.title.trim().charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              {listing.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {listing.publisher?.displayName || 'Anonymous'} ·{' '}
              {new Date(listing.publishedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {listing.description && (
          <p className="mt-4 text-muted leading-relaxed">
            {listing.description}
          </p>
        )}
      </section>

      {/* Interactive buttons (client) */}
      <MarketplaceDetailClient listing={listing} />

      {/* Links list */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold text-text">
          Links ({listingLinks.length})
        </h2>
        {listingLinks.length === 0 ? (
          <EmptyState title="No links in this collection." />
        ) : (
          <div className="flex flex-col gap-3">
            {listingLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mochi-card mochi-spring flex items-start gap-3 p-5 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                  {link.faviconUrl ? (
                    <img
                      src={link.faviconUrl}
                      alt=""
                      className="h-5 w-5 rounded"
                      loading="lazy"
                    />
                  ) : (
                    <ExternalLink size={18} className="text-accent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-text">{link.title}</h3>
                  {link.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">{link.description}</p>
                  )}
                  <p className="mt-1 truncate text-xs text-muted">{link.url}</p>
                </div>
                <ExternalLink size={16} className="mt-1 shrink-0 text-muted" />
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
