'use client'

import React from 'react'
import Link from 'next/link'
import { Star, GitFork } from 'lucide-react'
import { CollectionAvatar } from '@/components/ui/CollectionAvatar'
import type { MarketplaceListing } from '@/lib/types'

interface Props {
  listing: MarketplaceListing
}

export function MarketplaceCard({ listing }: Props) {
  const { title, description, collection, publisher, subscriberCount, forkCount } = listing

  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="mochi-card mochi-spring group relative flex flex-col gap-4 p-6 hover:-translate-y-2 hover:shadow-xl"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {collection.icon ? (
          <span className="text-3xl leading-none">{collection.icon}</span>
        ) : (
          <CollectionAvatar title={title} className="h-12 w-12 text-xl" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-[family-name:var(--font-heading)] text-xl font-bold text-text">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {publisher?.displayName || 'Anonymous'}
          </p>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}

      {/* Stats */}
      <div className="mt-auto flex items-center gap-4">
        <span className="flex items-center gap-1.5 rounded-full bg-yellow-300/15 px-3 py-1 text-xs font-semibold text-yellow-300">
          <Star size={14} />
          {subscriberCount}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-yellow-300/15 px-3 py-1 text-xs font-semibold text-yellow-300">
          <GitFork size={14} />
          {forkCount}
        </span>
      </div>
    </Link>
  )
}
