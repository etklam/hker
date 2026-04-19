'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Trash2, Plus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import type { InviteLink } from '@/lib/types'

interface Props {
  collectionId: number
}

export function InviteManagePanel({ collectionId }: Props) {
  const { t } = useTranslation()
  const [invites, setInvites] = useState<InviteLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [role, setRole] = useState<'viewer' | 'editor'>('viewer')
  const [maxUses, setMaxUses] = useState('')
  const [expiresInHours, setExpiresInHours] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api<InviteLink[]>(`/api/me/collections/${collectionId}/invites`)
      setInvites(data)
    } catch {
      pushToast(t('invites.errors.load'), 'error')
    } finally {
      setLoading(false)
    }
  }, [collectionId, t])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const maxUsesNum = maxUses ? Number(maxUses) : undefined
    const expiresNum = expiresInHours ? Number(expiresInHours) : undefined

    if (maxUsesNum !== undefined && (maxUsesNum < 1 || maxUsesNum > 10000)) {
      pushToast(t('invites.errors.maxUses'), 'error')
      return
    }
    if (expiresNum !== undefined && (expiresNum < 1 || expiresNum > 8760)) {
      pushToast(t('invites.errors.expires'), 'error')
      return
    }

    setCreating(true)
    try {
      const invite = await api<InviteLink>(`/api/me/collections/${collectionId}/invites`, {
        method: 'POST',
        body: {
          role,
          maxUses: maxUsesNum,
          expiresInHours: expiresNum,
        },
      })
      setInvites((prev) => [...prev, invite])
      setMaxUses('')
      setExpiresInHours('')
    } catch {
      pushToast(t('invites.errors.create'), 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      pushToast(t('invites.copySuccess'), 'success')
    } catch {
      pushToast(t('invites.errors.copy'), 'error')
    }
  }

  async function handleDelete(inviteId: number) {
    if (!confirm(t('invites.confirmDelete'))) return
    try {
      await api(`/api/me/collections/${collectionId}/invites/${inviteId}`, {
        method: 'DELETE',
      })
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
    } catch {
      pushToast(t('invites.errors.delete'), 'error')
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text">
          {t('invites.title')}
        </h3>
        <p className="text-sm text-muted">{t('invites.subtitle')}</p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{t('invites.roleLabel')}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="viewer">{t('invites.role.viewer')}</option>
            <option value="editor">{t('invites.role.editor')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{t('invites.maxUsesLabel')}</span>
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder={t('invites.maxUsesPlaceholder')}
            className="w-28 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            min={1}
            max={10000}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{t('invites.expiresLabel')}</span>
          <input
            type="number"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            placeholder={t('invites.expiresPlaceholder')}
            className="w-28 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            min={1}
            max={8760}
          />
        </label>

        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 rounded-xl bg-cta px-4 py-2 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 disabled:opacity-50 mochi-spring"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t('invites.create')}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted">{t('invites.loading')}</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted">{t('invites.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">
                  {t('invites.usage', {
                    role: t(`invites.role.${invite.role}`),
                    useCount: invite.useCount,
                    maxUses: invite.maxUses ?? t('invites.unlimited'),
                  })}
                </p>
                {invite.expiresAt && (
                  <p className="text-xs text-muted">
                    {new Date(invite.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(invite.url)}
                className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent active:scale-95 mochi-spring"
                aria-label={t('invites.copy')}
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(invite.id)}
                className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500 active:scale-95 mochi-spring"
                aria-label={t('invites.delete')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
