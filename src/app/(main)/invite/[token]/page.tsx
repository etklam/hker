'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle, Users, Clock, Shield, CheckCircle2, LogIn } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import { useAuth } from '@/lib/auth'
import type { InviteInfo, InviteJoinResponse } from '@/lib/types'

export default function InviteJoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api<InviteInfo>(`/api/invites/${token}`)
      setInvite(data)
    } catch (e: unknown) {
      const err = e as { status?: number }
      if (err.status === 404) notFound()
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleJoin() {
    setJoining(true)
    try {
      const result = await api<InviteJoinResponse>(`/api/invites/${token}/join`, { method: 'POST' })
      pushToast(t('inviteJoin.subtitle', { title: result.collection.title }), 'success')
      router.push(`/me/collections/${result.collection.id}`)
    } catch {
      pushToast(t('inviteJoin.errors.join'), 'error')
    } finally {
      setJoining(false)
    }
  }

  function handleLogin() {
    router.push(`/login?returnTo=/invite/${token}`)
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    )
  }

  if (!invite) return null

  const expiresAt = invite.expiresAt ? new Date(invite.expiresAt) : null
  const isExpired = expiresAt ? new Date() > expiresAt : false
  const maxUsesLabel = invite.maxUses !== null ? String(invite.maxUses) : '∞'

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--accent-soft)] px-8 py-6 text-center">
          {invite.collection.icon && (
            <span className="mb-2 inline-block text-4xl">{invite.collection.icon}</span>
          )}
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-text">
            {t('inviteJoin.title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t('inviteJoin.subtitle', { title: invite.collection.title })}
          </p>
        </div>

        {/* Info */}
        <div className="space-y-4 px-8 py-6">
          {invite.collection.description && (
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {invite.collection.description}
            </p>
          )}

          <div className="space-y-3">
            {/* Role */}
            <div className="flex items-center gap-3 text-sm">
              <Shield size={16} className="text-accent shrink-0" />
              <span className="text-[var(--muted)]">{t('invites.roleLabel')}:</span>
              <span className="font-medium text-text capitalize">{t(`invites.role.${invite.role}`)}</span>
            </div>

            {/* Usage */}
            <div className="flex items-center gap-3 text-sm">
              <Users size={16} className="text-accent shrink-0" />
              <span className="text-[var(--muted)]">{t('invites.maxUsesLabel')}:</span>
              <span className="font-medium text-text">{invite.useCount} / {maxUsesLabel}</span>
            </div>

            {/* Expiry */}
            {expiresAt && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className={`shrink-0 ${isExpired ? 'text-red-400' : 'text-accent'}`} />
                <span className="text-[var(--muted)]">{t('invites.expiresLabel')}:</span>
                <span className={`font-medium ${isExpired ? 'text-red-400' : 'text-text'}`}>
                  {expiresAt.toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-3 text-sm">
              {invite.isValid ? (
                <>
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  <span className="font-medium text-green-500">Valid</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span className="font-medium text-red-400">Invalid</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="border-t border-[var(--border)] px-8 py-6">
          {invite.isValid ? (
            user ? (
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3 text-sm font-bold text-white hover:bg-cta-hover hover:scale-[1.02] active:scale-95 mochi-spring disabled:opacity-60 disabled:pointer-events-none"
              >
                {joining ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {joining ? t('common.loading') : t('inviteJoin.joinNow')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3 text-sm font-bold text-white hover:bg-cta-hover hover:scale-[1.02] active:scale-95 mochi-spring"
              >
                <LogIn size={18} />
                {t('inviteJoin.loginToJoin')}
              </button>
            )
          ) : (
            <div className="rounded-xl bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-400">
              {t('inviteJoin.invalid')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
