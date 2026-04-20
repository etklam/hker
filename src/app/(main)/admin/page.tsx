'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api-client'
import { Users, Bookmark, Link2 } from 'lucide-react'

interface Stats {
  users: number
  collections: number
  links: number
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Stats>('/api/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  const cards = [
    { label: t('admin.statsUsers'), value: stats?.users ?? 0, icon: Users },
    { label: t('admin.statsCollections'), value: stats?.collections ?? 0, icon: Bookmark },
    { label: t('admin.statsLinks'), value: stats?.links ?? 0, icon: Link2 },
  ]

  return (
    <div>
      <h2 className="mb-6 text-lg font-bold text-text">{t('admin.overview')}</h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="mochi-card p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Icon size={20} strokeWidth={2} />
            </div>
            <p className="text-3xl font-extrabold text-text">{value.toLocaleString()}</p>
            <p className="mt-1 text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
