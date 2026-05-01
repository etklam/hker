'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import type { Link } from '@/lib/types'

interface MetadataResult {
  title: string | null
  description: string | null
  faviconUrl: string | null
  imageUrl: string | null
}

interface Props {
  collectionId: number
  link?: Link
  onClose: () => void
  onSuccess: (l: Link) => void
}

export function LinkFormModal({ collectionId, link, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const isEdit = !!link
  const [title, setTitle] = useState(link?.title ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [description, setDescription] = useState(link?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const lastFetchedUrl = useRef<string | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  async function handleUrlBlur() {
    const trimmed = url.trim()
    if (!trimmed || isEdit || trimmed === lastFetchedUrl.current) return

    // Basic validation before making the request
    try {
      const parsed = new URL(trimmed)
      if (!['http:', 'https:'].includes(parsed.protocol)) return
    } catch {
      return
    }

    lastFetchedUrl.current = trimmed
    setFetchingMeta(true)
    try {
      const meta = await api<MetadataResult>('/api/links/fetch-metadata', {
        method: 'POST',
        body: { url: trimmed },
      })

      // Only fill if the fields are empty (don't overwrite user input)
      if (!title.trim() && meta.title) {
        setTitle(meta.title)
      }
      if (!description.trim() && meta.description) {
        setDescription(meta.description)
      }
    } catch {
      // Silently fail — metadata fetch is optional
    } finally {
      setFetchingMeta(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !url.trim()) {
      pushToast(t('links.errors.required'), 'error')
      return
    }

    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
      }
      let result: Link
      if (isEdit) {
        result = await api<Link>(`/api/me/collections/${collectionId}/links/${link.id}`, {
          method: 'PATCH',
          body,
        })
      } else {
        result = await api<Link>(`/api/me/collections/${collectionId}/links`, {
          method: 'POST',
          body,
        })
      }
      onSuccess(result)
    } catch {
      pushToast(t('links.errors.save'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-modal-title"
    >
      <div
        className="mochi-card mx-4 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 id="link-modal-title" className="font-[family-name:var(--font-heading)] text-xl font-bold text-text">
            {isEdit ? t('links.edit') : t('links.create')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent active:scale-95 mochi-spring"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {t('links.fields.title')}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
              autoFocus
            />
          </label>

          {/* URL */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {t('links.fields.url')}
            </span>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
                placeholder="https://"
              />
              {fetchingMeta && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />
              )}
            </div>
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {t('links.fields.description')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
            />
          </label>

          {/* Actions */}
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-muted hover:bg-accent-soft active:scale-95 mochi-spring"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cta px-5 py-2.5 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 disabled:opacity-50 mochi-spring"
            >
              {saving ? t('common.saving') : isEdit ? t('common.update') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
