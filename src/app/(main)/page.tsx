'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { api } from '@/lib/api-client'
import {
  Bookmark,
  Store,
  CheckSquare,
  Heart,
  ArrowRight,
  ExternalLink,
  Calculator,
  Calendar,
  FileText,
  ReceiptText,
  AlertCircle,
} from 'lucide-react'
import {
  calculateMonthlyBillSummary,
  formatHKD,
  getCurrentMonthKey,
} from '@/lib/tools/monthly-bills'
import type { MonthlyBillBoardResponse } from '@/lib/types'

interface HealthResponse {
  status: string
  timestamp: string
}

interface FeaturedLink {
  id: number
  title: string
  url: string
  description: string | null
  faviconUrl: string | null
  sortOrder: number
}

interface FeaturedCollection {
  id: number
  title: string
  description: string | null
  icon: string | null
  linkCount: number
  links: FeaturedLink[]
}

interface FeaturedResponse {
  collections: FeaturedCollection[]
}

const QUICK_TOOLS = [
  { key: 'mortgage', href: '/tools/mortgage', icon: Calculator },
  { key: 'resignation', href: '/tools/resignation-last-day', icon: Calendar },
  { key: 'chequeAmount', href: '/tools/cheque-amount', icon: FileText },
] as const

const SECONDARY_NAV: ReadonlyArray<{
  href: string
  labelKey: string
  descKey: string
  icon: typeof Bookmark
  beta?: boolean
}> = [
  { href: '/spaces', labelKey: 'home.features.spaces.title', descKey: 'home.features.spaces.description', icon: CheckSquare },
  { href: '/me/collections', labelKey: 'home.features.collections.title', descKey: 'home.features.collections.description', icon: Bookmark },
  { href: '/marketplace', labelKey: 'home.features.marketplace.title', descKey: 'home.features.marketplace.description', icon: Store, beta: true },
]

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [theme] = useTheme()
  const [health, setHealth] = useState<string | null>(null)
  const [featured, setFeatured] = useState<FeaturedCollection[]>([])
  const [board, setBoard] = useState<MonthlyBillBoardResponse | null>(null)

  useEffect(() => {
    api<HealthResponse>('/api/health')
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('error'))
  }, [])

  useEffect(() => {
    api<FeaturedResponse>('/api/featured')
      .then((data) => setFeatured(data.collections))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) {
      setBoard(null)
      return
    }
    const monthKey = getCurrentMonthKey()
    const [year, month] = monthKey.split('-').map(Number)
    api<MonthlyBillBoardResponse>(`/api/monthly-bills?year=${year}&month=${month}`)
      .then(setBoard)
      .catch(() => setBoard(null))
  }, [user])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      {user ? (
        <LoggedInDashboard
          user={user}
          health={health}
          theme={theme}
          board={board}
          t={t}
          i18n={i18n}
        />
      ) : (
        <LoggedOutLanding
          health={health}
          theme={theme}
          featured={featured}
          t={t}
        />
      )}
    </div>
  )
}

function LoggedInDashboard({
  user,
  health,
  theme,
  board,
  t,
  i18n,
}: {
  user: { displayName: string | null; email: string | null }
  health: string | null
  theme: string
  board: MonthlyBillBoardResponse | null
  t: (key: string, options?: Record<string, unknown>) => string
  i18n: { language: string }
}) {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="mb-10">
        <p className="mb-3 text-lg text-muted">
          {t('home.greeting', { name: user.displayName || user.email })}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-accent sm:text-5xl">
          {t('home.dashboard.heading')}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">
          {t('home.dashboard.subtitle')}
        </p>
      </section>

      {/* ─── Monthly Bills flagship widget ─── */}
      <section className="mb-10">
        <BillsDashboardWidget board={board} t={t} language={i18n.language} />
      </section>

      {/* ─── Secondary surfaces ─── */}
      <section className="mb-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {SECONDARY_NAV.map(({ href, labelKey, descKey, icon: Icon, beta }) => (
            <Link key={href} href={href} className="group">
              <div className="mochi-card mochi-spring flex h-full flex-col p-5 hover:-translate-y-1">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={18} strokeWidth={2.4} />
                  </div>
                  <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-text">
                    {t(labelKey)}
                  </h3>
                  {beta && (
                    <span className="ml-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                      Beta
                    </span>
                  )}
                </div>
                <p className="flex-1 text-xs leading-relaxed text-muted">
                  {t(descKey)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent group-hover:gap-2 mochi-spring">
                  <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Quick Tools ─── */}
      <section className="mb-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text">
              {t('home.tools.title')}
            </h2>
            <p className="mt-1 text-sm text-muted">{t('home.tools.subtitle')}</p>
          </div>
          <Link
            href="/tools"
            className="mochi-spring shrink-0 text-sm font-medium text-accent hover:underline"
          >
            {t('home.tools.useNow')} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_TOOLS.map(({ key, href, icon: Icon }) => (
            <Link key={key} href={href} className="group">
              <div className="mochi-card mochi-spring flex h-full items-center gap-3 p-4 hover:-translate-y-1">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-text">
                    {t(`tools.${key}.title`)}
                  </h3>
                  <p className="truncate text-xs text-muted">
                    {t(`tools.${key}.description`)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <StatusFooter health={health} theme={theme} t={t} />
    </>
  )
}

function LoggedOutLanding({
  health,
  theme,
  featured,
  t,
}: {
  health: string | null
  theme: string
  featured: FeaturedCollection[]
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="mb-16 text-left sm:mb-20">
        <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold tracking-tight text-accent sm:text-7xl">
          HKER
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted sm:text-xl">
          {t('home.tagline')}
        </p>

        <div className="mt-8 flex items-center gap-4">
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
      </section>

      {/* ─── Flagship: Monthly Bills ─── */}
      <section className="mb-12">
        <Link href="/bills" className="group block">
          <div className="mochi-card mochi-spring flex flex-col gap-4 p-8 hover:-translate-y-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <ReceiptText size={28} strokeWidth={2.4} />
              </div>
              <div>
                <span className="mb-1 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  Flagship
                </span>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text sm:text-3xl">
                  {t('home.features.monthlyBills.title')}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
                  {t('home.features.monthlyBills.description')}
                </p>
              </div>
            </div>
            <span className="mochi-spring inline-flex shrink-0 items-center gap-1.5 self-start rounded-2xl bg-cta px-5 py-3 text-sm font-bold text-white group-hover:gap-2.5 sm:self-center">
              {t('home.features.monthlyBills.cta')}
              <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      </section>

      {/* ─── Featured Collections (admin curated) ─── */}
      {featured.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-center text-xl font-bold text-text sm:text-2xl">
            {t('home.featured.title')}
          </h2>
          <p className="mb-6 text-center text-xs text-muted">
            {t('home.featured.subtitle')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((col) => (
              <div key={col.id} className="mochi-card flex flex-col p-5">
                <div className="mb-3 flex items-center gap-2">
                  {col.icon && <span className="text-xl">{col.icon}</span>}
                  <h3 className="text-base font-bold text-text">{col.title}</h3>
                </div>
                {col.description && (
                  <p className="mb-3 text-xs text-muted line-clamp-2">{col.description}</p>
                )}
                <div className="flex-1 space-y-1.5">
                  {col.links.slice(0, 5).map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mochi-spring flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs text-text hover:bg-accent-soft/50 hover:border-border-strong"
                    >
                      {link.faviconUrl && (
                        <img
                          src={link.faviconUrl}
                          alt=""
                          className="h-3.5 w-3.5 rounded"
                          loading="lazy"
                        />
                      )}
                      <span className="flex-1 truncate">{link.title}</span>
                      <ExternalLink size={10} className="shrink-0 text-muted" />
                    </a>
                  ))}
                  {col.linkCount > 5 && (
                    <p className="text-xs text-muted text-center pt-1">
                      +{col.linkCount - 5} {t('home.featured.more')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Other surfaces ─── */}
      <section className="mb-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {SECONDARY_NAV.map(({ href, labelKey, descKey, icon: Icon, beta }) => (
            <Link key={href} href={href} className="group">
              <div className="mochi-card mochi-spring flex h-full flex-col p-5 hover:-translate-y-1">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={18} strokeWidth={2.4} />
                  </div>
                  <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-text">
                    {t(labelKey)}
                  </h3>
                  {beta && (
                    <span className="ml-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                      Beta
                    </span>
                  )}
                </div>
                <p className="flex-1 text-xs leading-relaxed text-muted">
                  {t(descKey)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent group-hover:gap-2 mochi-spring">
                  <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Quick Tools ─── */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text">
            {t('home.tools.title')}
          </h2>
          <p className="mt-1 text-sm text-muted">{t('home.tools.subtitle')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_TOOLS.map(({ key, href, icon: Icon }) => (
            <Link key={key} href={href} className="group">
              <div className="mochi-card mochi-spring flex h-full items-center gap-3 p-4 hover:-translate-y-1">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-text">
                    {t(`tools.${key}.title`)}
                  </h3>
                  <p className="truncate text-xs text-muted">
                    {t(`tools.${key}.description`)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <StatusFooter health={health} theme={theme} t={t} />
    </>
  )
}

function BillsDashboardWidget({
  board,
  t,
  language,
}: {
  board: MonthlyBillBoardResponse | null
  t: (key: string, options?: Record<string, unknown>) => string
  language: string
}) {
  const summary = useMemo(
    () => (board ? calculateMonthlyBillSummary(board.items) : null),
    [board],
  )

  const nextDue = useMemo(() => {
    if (!board || board.items.length === 0) return null
    const today = new Date().toISOString().slice(0, 10)
    return (
      board.items
        .filter((item) => !item.checkedAt && item.dueDate >= today)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
    )
  }, [board])

  function formatDueDateLabel(dateKey: string): string {
    const [, month, day] = dateKey.split('-').map(Number)
    if (language === 'zh-HK') return `${month}月${day}日`
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-HK', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="mochi-card overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ReceiptText size={28} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text">
              {t('home.dashboard.billsWidget.title')}
            </h2>
            {!board || !board.activeList ? (
              <p className="mt-1 text-sm text-muted">
                {t('home.dashboard.billsWidget.noList')}
              </p>
            ) : summary && summary.totalCount === 0 ? (
              <p className="mt-1 text-sm text-muted">
                {t('home.dashboard.billsWidget.noBills')}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-bold text-text">
                  {t('home.dashboard.billsWidget.paid', {
                    paid: summary?.paidCount ?? 0,
                    total: summary?.totalCount ?? 0,
                  })}
                </span>
                {summary && summary.unpaidAmountCents > 0 && (
                  <span className="text-muted">
                    · {t('home.dashboard.billsWidget.unpaidAmount', {
                      amount: formatHKD(summary.unpaidAmountCents),
                    })}
                  </span>
                )}
                {summary && summary.overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-red-500">
                    <AlertCircle size={12} />
                    {t('home.dashboard.billsWidget.overdue', { count: summary.overdueCount })}
                  </span>
                )}
                {summary && summary.dueTodayCount > 0 && (
                  <span className="font-medium text-amber-600">
                    {t('home.dashboard.billsWidget.dueToday', { count: summary.dueTodayCount })}
                  </span>
                )}
              </div>
            )}
            {nextDue && (
              <p className="mt-1 text-xs text-muted">
                {t('home.dashboard.billsWidget.nextDue', {
                  name: nextDue.name,
                  date: formatDueDateLabel(nextDue.dueDate),
                })}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/bills"
          className="mochi-spring inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-cta px-5 py-3 text-sm font-bold text-white hover:bg-cta-hover"
        >
          {t('home.dashboard.billsWidget.openBills')}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}

function StatusFooter({
  health,
  theme,
  t,
}: {
  health: string | null
  theme: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted">
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
  )
}
