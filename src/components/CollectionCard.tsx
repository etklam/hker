'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { CollectionAvatar } from '@/components/ui/CollectionAvatar'
import type { Collection } from '@/lib/types'

interface Props {
  collection: Collection
  onEdit: () => void
  onDelete: () => void
}

const visibilityColors: Record<string, string> = {
  private: 'bg-muted/20 text-muted',
  unlisted: 'bg-amber-500/15 text-amber-600',
  public: 'bg-emerald-500/15 text-emerald-600',
}

export function CollectionCard({ collection, onEdit, onDelete }: Props) {
  const { t } = useTranslation()
  const isOwner = collection.access === 'owner'

  return (
    <Link
      href={`/me/collections/${collection.id}`}
      className="mochi-card mochi-spring group relative flex flex-col gap-3 p-6 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {collection.icon ? (
          <span className="text-2xl leading-none">{collection.icon}</span>
        ) : (
          <CollectionAvatar title={collection.title} />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-[family-name:var(--font-heading)] text-lg font-bold text-text">
            {collection.title}
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {t('collections.linksCount', { count: collection.linkCount })}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${visibilityColors[collection.visibility] || visibilityColors.private}`}
        >
          {collection.visibility}
        </span>
        {collection.access !== 'owner' && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            {t('collections.shared')}
          </span>
        )}
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit()
            }}
            className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent active:scale-95 mochi-spring"
            aria-label={t('common.edit')}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500 active:scale-95 mochi-spring"
            aria-label={t('common.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </Link>
  )
}
