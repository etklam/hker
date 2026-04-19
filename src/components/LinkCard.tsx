'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import type { Link as LinkType } from '@/lib/types'

interface Props {
  link: LinkType
  onEdit: () => void
  onDelete: () => void
  readOnly?: boolean
}

export function LinkCard({ link, onEdit, onDelete, readOnly }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mochi-card mochi-spring group relative flex items-start gap-3 p-5 hover:rotate-1 hover:-translate-y-1 hover:shadow-xl">
      {/* Favicon */}
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

      {/* Content */}
      <div className="min-w-0 flex-1">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-heading)] font-bold text-text hover:text-accent mochi-spring"
        >
          {link.title}
        </a>
        {link.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{link.description}</p>
        )}
        <p className="mt-1 truncate text-xs text-muted/70">{link.url}</p>
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent active:scale-95 mochi-spring"
            aria-label={t('common.edit')}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500 active:scale-95 mochi-spring"
            aria-label={t('common.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
