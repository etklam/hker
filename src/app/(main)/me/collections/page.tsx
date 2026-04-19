'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import type { Collection } from '@/lib/types'
import { CollectionCard } from '@/components/CollectionCard'
import { CollectionFormModal } from '@/components/CollectionFormModal'

export default function MyCollectionsPage() {
  const { t } = useTranslation()
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Collection | undefined>()

  const load = useCallback(async () => {
    try {
      const data = await api<Collection[]>('/api/me/collections')
      setCollections(data)
    } catch {
      pushToast(t('collections.errors.load'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(undefined)
    setModalOpen(true)
  }

  function openEdit(collection: Collection) {
    setEditing(collection)
    setModalOpen(true)
  }

  async function handleDelete(collection: Collection) {
    if (!confirm(t('collections.delete_confirm', { title: collection.title }))) return
    try {
      await api(`/api/me/collections/${collection.id}`, { method: 'DELETE' })
      setCollections((prev) => prev.filter((c) => c.id !== collection.id))
    } catch {
      pushToast(t('collections.errors.delete'), 'error')
    }
  }

  function handleFormSuccess() {
    setModalOpen(false)
    setEditing(undefined)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-text">
          {t('collections.title')}
        </h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-cta px-5 py-2.5 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 mochi-spring"
        >
          <Plus size={18} />
          {t('collections.create')}
        </button>
      </div>

      {/* Grid */}
      {collections.length === 0 ? (
        <p className="py-16 text-center text-muted">{t('collections.empty')}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onEdit={() => openEdit(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <CollectionFormModal
          collection={editing}
          onClose={() => {
            setModalOpen(false)
            setEditing(undefined)
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}
