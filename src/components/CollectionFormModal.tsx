'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import type { Collection } from '@/lib/types'

interface Props {
  collection?: Collection
  onClose: () => void
  onSuccess: (c: Collection) => void
}

export function CollectionFormModal({ collection, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const isEdit = !!collection
  const [title, setTitle] = useState(collection?.title ?? '')
  const [description, setDescription] = useState(collection?.description ?? '')
  const [icon, setIcon] = useState(collection?.icon ?? '')
  const [saving, setSaving] = useState(false)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      pushToast(t('collections.errors.requiredTitle'), 'error')
      return
    }

    setSaving(true)
    try {
      const body = {
        title: trimmed,
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      }
      let result: Collection
      if (isEdit) {
        result = await api<Collection>(`/api/me/collections/${collection.id}`, {
          method: 'PATCH',
          body,
        })
      } else {
        result = await api<Collection>('/api/me/collections', {
          method: 'POST',
          body,
        })
      }
      onSuccess(result)
    } catch {
      pushToast(t('collections.errors.save'), 'error')
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
      aria-labelledby="collection-modal-title"
    >
      <div
        className="mochi-card mx-4 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 id="collection-modal-title" className="font-[family-name:var(--font-heading)] text-xl font-bold text-text">
            {isEdit ? t('collections.form.editTitle') : t('collections.form.createTitle')}
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
              {t('collections.form.fields.title')}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
              autoFocus
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {t('collections.form.fields.description')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
            />
          </label>

          {/* Icon */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {t('collections.form.fields.icon')}
            </span>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
              placeholder={t('collections.form.iconHint')}
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
