'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Calculator, Calendar, FileText, ArrowRight } from 'lucide-react'

const TOOLS = [
  {
    key: 'mortgage',
    href: '/tools/mortgage',
    icon: Calculator,
  },
  {
    key: 'resignation',
    href: '/tools/resignation-last-day',
    icon: Calendar,
  },
  {
    key: 'chequeAmount',
    href: '/tools/cheque-amount',
    icon: FileText,
  },
] as const

export default function ToolsHubPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      {/* Hero */}
      <section className="relative mb-16 text-center">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-accent sm:text-5xl">
          {t('tools.title')}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted">
          {t('tools.subtitle')}
        </p>
      </section>

      {/* Tool Cards Grid */}
      <section className="mb-16 grid gap-6 sm:grid-cols-3">
        {TOOLS.map(({ key, href, icon: Icon }) => (
          <Link key={key} href={href} className="group">
            <div className="mochi-card mochi-spring flex h-full flex-col p-8 hover:-translate-y-2">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Icon size={24} strokeWidth={2} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-text">
                {t(`tools.${key}.title`)}
              </h3>
              <p className="flex-1 text-sm text-muted">
                {t(`tools.${key}.description`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 mochi-spring">
                {t('tools.useNow')}
                <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* More coming soon hint */}
      <p className="text-center text-sm text-muted">
        {t('tools.moreComingSoon')}
      </p>
    </div>
  )
}
