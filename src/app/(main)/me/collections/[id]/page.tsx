'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, notFound } from 'next/navigation'
import NextLink from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Loader2, Globe, Store } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import { useCollectionAccess } from '@/hooks/useCollectionAccess'
import type { Collection, Link } from '@/lib/types'
import { LinkCard } from '@/components/LinkCard'
import { LinkFormModal } from '@/components/LinkFormModal'
import { CollectionFormModal } from '@/components/CollectionFormModal'
import { InviteManagePanel } from '@/components/InviteManagePanel'
import { MemberList } from '@/components/MemberList'
import { CollectionAvatar } from '@/components/ui/CollectionAvatar'

const visibilityColors: Record<string, string> = {
  private: 'bg-muted/20 text-muted',
  unlisted: 'bg-amber-500/15 text-amber-600',
  public: 'bg-emerald-500/15 text-emerald-600',
}

export default function CollectionDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const { t } = useTranslation()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const { canEdit, canManage } = useCollectionAccess(collection)

  // Modals
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<Link | undefined>()
  const [editCollectionOpen, setEditCollectionOpen] = useState(false)

  // Marketplace
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [anonymous, setAnonymous] = useState(false)

  const loadCollection = useCallback(async () => {
    try {
      const data = await api<Collection>(`/api/me/collections/${id}`)
      setCollection(data)
    } catch {
      pushToast(t('collections.errors.load'), 'error')
    }
  }, [id, t])

  const loadLinks = useCallback(async () => {
    try {
      const data = await api<Link[]>(`/api/me/collections/${id}/links`)
      setLinks(data)
    } catch {
      pushToast(t('collections.errors.load'), 'error')
    }
  }, [id, t])

  useEffect(() => {
    if (!id || isNaN(id)) return
    Promise.all([loadCollection(), loadLinks()]).finally(() => setLoading(false))
  }, [id, loadCollection, loadLinks])

  function openAddLink() {
    setEditingLink(undefined)
    setLinkModalOpen(true)
  }

  function openEditLink(link: Link) {
    setEditingLink(link)
    setLinkModalOpen(true)
  }

  async function handleDeleteLink(link: Link) {
    if (!confirm(t('collections.link_delete_confirm'))) return
    try {
      await api(`/api/me/collections/${id}/links/${link.id}`, { method: 'DELETE' })
      setLinks((prev) => prev.filter((l) => l.id !== link.id))
    } catch {
      pushToast(t('links.errors.delete'), 'error')
    }
  }

  function handleLinkFormSuccess() {
    setLinkModalOpen(false)
    setEditingLink(undefined)
    loadLinks()
  }

  function handleCollectionEditSuccess(updated: Collection) {
    setCollection(updated)
    setEditCollectionOpen(false)
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await api(`/api/marketplace/publish/${id}?anonymous=${anonymous}`, {
        method: 'POST',
      })
      pushToast(t('collections.marketplace.publishSuccess'), 'success')
      await loadCollection()
    } catch {
      pushToast(t('collections.marketplace.publishError'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  async function handleUnpublish() {
    if (!confirm(t('collections.marketplace.confirmUnpublish'))) return
    setUnpublishing(true)
    try {
      await api(`/api/marketplace/unpublish/${id}`, { method: 'DELETE' })
      pushToast(t('collections.marketplace.unpublishSuccess'), 'success')
      await loadCollection()
    } catch {
      pushToast(t('collections.marketplace.unpublishError'), 'error')
    } finally {
      setUnpublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    )
  }

  if (!collection) notFound()

  const isPublished = collection.visibility === 'public'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back */}
      <NextLink
        href="/me/collections"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent mochi-spring"
      >
        <ArrowLeft size={16} />
        {t('common.backTo', { target: t('collections.title') })}
      </NextLink>

      {/* Collection header */}
      <div className="mochi-card mb-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6">
        {collection.icon ? (
          <span className="text-4xl leading-none">{collection.icon}</span>
        ) : (
          <CollectionAvatar title={collection.title} className="!h-14 !w-14 !text-2xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-[family-name:var(--font-heading)] text-2xl font-extrabold text-text">
              {collection.title}
            </h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${visibilityColors[collection.visibility] || visibilityColors.private}`}
            >
              {collection.visibility}
            </span>
          </div>
          {collection.description && (
            <p className="mt-1 text-sm text-muted">{collection.description}</p>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditCollectionOpen(true)}
            className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text hover:bg-accent-soft hover:text-accent active:scale-95 mochi-spring"
          >
            {t('common.edit')}
          </button>
        )}
      </div>

      {/* Links section */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text">
            {t('collections.linksTitle')}
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={openAddLink}
              className="flex items-center gap-1.5 rounded-xl bg-cta px-4 py-2 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 mochi-spring"
            >
              <Plus size={16} />
              {t('collections.addLink')}
            </button>
          )}
        </div>

        {links.length === 0 ? (
          <p className="py-12 text-center text-muted">{t('collections.linksEmpty')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onEdit={() => openEditLink(link)}
                onDelete={() => handleDeleteLink(link)}
                readOnly={!canEdit}
              />
            ))}
          </div>
        )}
      </section>

      {/* Owner-only sections */}
      {canManage && (
        <>
          {/* Marketplace publish/unpublish */}
          <section className="mochi-card mb-8 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Store size={20} className="text-accent" />
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text">
                {t('collections.marketplace.title')}
              </h3>
            </div>
            <p className="mb-4 text-sm text-muted">
              {t('collections.marketplace.subtitle')}
            </p>

            {isPublished ? (
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={unpublishing}
                className="rounded-xl border border-red-500/30 px-5 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/10 active:scale-95 disabled:opacity-50 mochi-spring"
              >
                {unpublishing
                  ? t('collections.marketplace.unpublishing')
                  : t('collections.marketplace.unpublish')}
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="rounded accent-accent"
                  />
                  {t('collections.marketplace.anonymous')}
                </label>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1.5 rounded-xl bg-cta px-5 py-2.5 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 disabled:opacity-50 mochi-spring"
                >
                  <Globe size={16} />
                  {publishing
                    ? t('collections.marketplace.publishing')
                    : t('collections.marketplace.publish')}
                </button>
              </div>
            )}
          </section>

          {/* Invites */}
          <div className="mochi-card mb-8 p-6">
            <InviteManagePanel collectionId={id} />
          </div>

          {/* Members */}
          <div className="mochi-card mb-8 p-6">
            <MemberList collectionId={id} />
          </div>
        </>
      )}

      {/* Link form modal */}
      {linkModalOpen && (
        <LinkFormModal
          collectionId={id}
          link={editingLink}
          onClose={() => {
            setLinkModalOpen(false)
            setEditingLink(undefined)
          }}
          onSuccess={handleLinkFormSuccess}
        />
      )}

      {/* Collection edit modal */}
      {editCollectionOpen && (
        <CollectionFormModal
          collection={collection}
          onClose={() => setEditCollectionOpen(false)}
          onSuccess={handleCollectionEditSuccess}
        />
      )}
    </div>
  )
}
