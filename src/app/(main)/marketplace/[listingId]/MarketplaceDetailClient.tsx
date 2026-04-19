'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Star, GitFork, LogIn } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import type { MarketplaceListing } from '@/lib/types'

interface Props {
  listing: MarketplaceListing
}

export function MarketplaceDetailClient({ listing }: Props) {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [subscribed, setSubscribed] = useState(false)
  const [subCount, setSubCount] = useState(listing.subscriberCount)
  const [forkCount, setForkCount] = useState(listing.forkCount)
  const [busy, setBusy] = useState(false)

  async function toggleSubscribe() {
    if (busy) return
    setBusy(true)
    try {
      if (subscribed) {
        await api(`/api/marketplace/${listing.id}/subscribe`, { method: 'DELETE' })
        setSubscribed(false)
        setSubCount((c) => Math.max(0, c - 1))
      } else {
        await api(`/api/marketplace/${listing.id}/subscribe`, { method: 'POST' })
        setSubscribed(true)
        setSubCount((c) => c + 1)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleFork() {
    if (busy) return
    if (!confirm(t('marketplace.fork_confirm'))) return
    setBusy(true)
    try {
      await api(`/api/marketplace/${listing.id}/fork`, { method: 'POST' })
      setForkCount((c) => c + 1)
      pushToast('Collection forked!', 'success')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) return null

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Stats */}
      <span className="flex items-center gap-1.5 rounded-full bg-yellow-300/15 px-3 py-1.5 text-sm font-semibold text-yellow-300">
        <Star size={16} />
        {subCount} subscribers
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-yellow-300/15 px-3 py-1.5 text-sm font-semibold text-yellow-300">
        <GitFork size={16} />
        {forkCount} forks
      </span>

      {/* Actions */}
      {user ? (
        <>
          <button
            type="button"
            onClick={toggleSubscribe}
            disabled={busy}
            className={`mochi-spring rounded-full px-5 py-2 text-sm font-medium active:scale-95 disabled:opacity-50 ${
              subscribed
                ? 'border border-border bg-surface text-muted hover:bg-accent-soft'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {subscribed ? t('marketplace.unsubscribe') : t('marketplace.subscribe')}
          </button>
          <button
            type="button"
            onClick={handleFork}
            disabled={busy}
            className="mochi-spring rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-text hover:bg-accent-soft active:scale-95 disabled:opacity-50"
          >
            <GitFork size={14} className="mr-1.5 inline" />
            {t('marketplace.fork')}
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="mochi-spring flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover active:scale-95"
        >
          <LogIn size={14} />
          Log in to subscribe
        </Link>
      )}
    </div>
  )
}
