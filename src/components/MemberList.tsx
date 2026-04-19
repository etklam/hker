'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import type { Member } from '@/lib/types'

interface Props {
  collectionId: number
}

const roleBadgeColors: Record<string, string> = {
  owner: 'bg-accent-soft text-accent',
  editor: 'bg-emerald-500/15 text-emerald-600',
  viewer: 'bg-muted/20 text-muted',
}

export function MemberList({ collectionId }: Props) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api<Member[]>(`/api/me/collections/${collectionId}/members`)
      setMembers(data)
    } catch {
      pushToast(t('members.errors.load'), 'error')
    } finally {
      setLoading(false)
    }
  }, [collectionId, t])

  useEffect(() => {
    load()
  }, [load])

  async function handleRemove(memberId: number) {
    if (!confirm(t('members.confirmRemove'))) return
    try {
      await api(`/api/me/collections/${collectionId}/members/${memberId}`, {
        method: 'DELETE',
      })
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      pushToast(t('members.errors.remove'), 'error')
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text">
          {t('members.title')}
        </h3>
        <p className="text-sm text-muted">{t('members.subtitle')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{t('members.loading')}</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted">{t('members.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
            >
              {/* Avatar */}
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {(member.displayName || member.email || '?').charAt(0).toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {member.displayName || member.email || t('members.userFallback', { id: member.userId })}
                </p>
              </div>

              {/* Role badge */}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeColors[member.role] || roleBadgeColors.viewer}`}
              >
                {member.role}
              </span>

              {/* Remove (only for non-owner members) */}
              {member.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
                  className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500 active:scale-95 mochi-spring"
                  aria-label={t('members.remove')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
