'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import {
  Plus,
  ArrowRight,
  Trash2,
  Loader2,
  CheckSquare,
  Pencil,
  X,
} from 'lucide-react'
import type { Space } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'

const roleBadge: Record<string, string> = {
  owner: 'bg-accent-soft text-accent',
  admin: 'bg-emerald-500/15 text-emerald-600',
  member: 'bg-muted/20 text-muted',
}

interface Props {
  initialSpaces: Space[]
}

export function SpaceClientView({ initialSpaces }: Props) {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return

    setCreating(true)
    try {
      const space = await api<Space>('/api/spaces/spaces', {
        method: 'POST',
        body: { name: trimmed },
      })
      setSpaces((prev) => [...prev, space])
      setNewName('')
      setShowCreate(false)
    } catch {
      pushToast(t('spaces.errors.saveSpace'), 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(sid: number) {
    if (!confirm(t('spaces.deleteSpaceConfirm'))) return
    try {
      await api(`/api/spaces/spaces/${sid}`, { method: 'DELETE' })
      setSpaces((prev) => prev.filter((s) => s.id !== sid))
    } catch {
      pushToast(t('spaces.errors.deleteSpace'), 'error')
    }
  }

  async function handleRename(sid: number) {
    const trimmed = editDraft.trim()
    if (!trimmed) { setEditingId(null); return }

    try {
      const updated = await api<Space>(`/api/spaces/spaces/${sid}`, {
        method: 'PATCH',
        body: { name: trimmed },
      })
      setSpaces((prev) => prev.map((s) => (s.id === sid ? { ...s, name: updated.name } : s)))
    } catch {
      pushToast(t('spaces.errors.saveSpace'), 'error')
    } finally {
      setEditingId(null)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare size={28} className="text-accent" />
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text">
            {t('nav.spaces')}
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-cta px-4 py-2.5 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 mochi-spring"
        >
          <Plus size={16} />
          {t('spaces.createSpace')}
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="mochi-card mx-4 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text">
                {t('spaces.newSpace')}
              </h2>
              <button onClick={() => setShowCreate(false)} className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent mochi-spring">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-text">{t('spaces.spaceName')}</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none focus:border-accent"
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted hover:bg-accent-soft mochi-spring">
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="rounded-xl bg-cta px-5 py-2.5 text-sm font-bold text-white hover:bg-cta-hover disabled:opacity-50 mochi-spring"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty state */}
      {spaces.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={48} />}
          title={t('spaces.empty')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="mochi-card flex flex-col gap-3 p-5"
            >
              <div className="flex items-start justify-between">
                {editingId === space.id ? (
                  <input
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={() => handleRename(space.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(space.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-lg font-bold text-text outline-none ring-1 ring-accent/30 focus:ring-accent"
                    autoFocus
                  />
                ) : (
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text">
                    {space.name}
                  </h3>
                )}

                <span className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge[space.role] || roleBadge.member}`}>
                  {space.role}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/spaces/spaces/${space.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-soft py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white mochi-spring"
                >
                  {t('spaces.enterBoard')}
                  <ArrowRight size={14} />
                </Link>

                {(space.role === 'owner' || space.role === 'admin') && (
                  <>
                    <button
                      onClick={() => { setEditingId(space.id); setEditDraft(space.name) }}
                      className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent mochi-spring"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(space.id)}
                      className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500 mochi-spring"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
