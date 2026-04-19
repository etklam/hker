'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { api } from '@/lib/api-client'
import { Bookmark, Store, CheckSquare, Heart, ArrowRight } from 'lucide-react'

interface HealthResponse {
  status: string
  timestamp: string
}

const FEATURES = [
  {
    key: 'collections',
    href: '/me/collections',
    icon: Bookmark,
  },
  {
    key: 'marketplace',
    href: '/marketplace',
    icon: Store,
  },
  {
    key: 'familyTodo',
    href: '/family-todo',
    icon: CheckSquare,
  },
] as const

export default function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [theme] = useTheme()
  const [health, setHealth] = useState<string | null>(null)

  useEffect(() => {
    api<HealthResponse>('/api/health')
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('error'))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      {/* ─── Hero ─── */}
      <section className="relative mb-16 text-center sm:mb-24">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 left-1/4 -z-10 h-48 w-48 rounded-full bg-cta/10 blur-2xl" />

        {user && (
          <p className="mb-4 text-lg text-muted">
            {t('home.greeting', { name: user.displayName || user.email })}
          </p>
        )}

        <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold tracking-tight text-accent sm:text-7xl">
          HKER
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted sm:text-xl">
          {t('home.tagline')}
        </p>

        {!user && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="mochi-spring rounded-xl bg-accent px-6 py-3 font-medium text-white hover:bg-accent-hover active:scale-[0.98]"
            >
              {t('home.getStarted')}
            </Link>
            <Link
              href="/login"
              className="mochi-spring rounded-xl border border-border px-6 py-3 font-medium text-text hover:bg-accent-soft active:scale-[0.98]"
            >
              {t('auth.submitLogin')}
            </Link>
          </div>
        )}
      </section>

      {/* ─── Feature Cards ─── */}
      <section className="mb-16 grid gap-6 sm:grid-cols-3">
        {FEATURES.map(({ key, href, icon: Icon }) => (
          <Link key={key} href={href} className="group">
            <div className="mochi-card mochi-spring flex h-full flex-col p-8 hover:-translate-y-2">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Icon size={24} strokeWidth={2} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-text">
                {t(`home.features.${key}.title`)}
              </h3>
              <p className="flex-1 text-sm text-muted">
                {t(`home.features.${key}.description`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 mochi-spring">
                {t(`home.features.${key}.cta`)}
                <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* ─── Status Footer ─── */}
      <footer className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Heart size={12} />
          {t('home.madeWith')}
        </span>
        <span>·</span>
        <span>{t('theme.label')}: {t(`theme.${theme}`)}</span>
        <span>·</span>
        <span>
          {health === null
            ? t('home.loadingHealth')
            : health === 'error'
              ? '⚠ ' + t('home.errors.loadHealth')
              : `✓ ${health}`}
        </span>
      </footer>
    </div>
  )
}
