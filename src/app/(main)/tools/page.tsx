'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Calculator, Calendar, FileText, ArrowRight, ReceiptText } from 'lucide-react'

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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      {/* Flagship pointer */}
      <section className="mb-12 mochi-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ReceiptText size={24} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text">
              {t('home.features.monthlyBills.title')}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {t('home.features.monthlyBills.description')}
            </p>
          </div>
        </div>
        <Link
          href="/bills"
          className="mochi-spring inline-flex shrink-0 items-center gap-2 rounded-2xl bg-cta px-5 py-3 text-sm font-bold text-white hover:bg-cta-hover"
        >
          {t('home.features.monthlyBills.cta')}
          <ArrowRight size={16} />
        </Link>
      </section>

      {/* Quick tools */}
      <section className="mb-12">
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-accent sm:text-4xl">
            {t('home.tools.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            {t('home.tools.subtitle')}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ key, href, icon: Icon }) => (
            <Link key={key} href={href} className="group">
              <div className="mochi-card mochi-spring flex h-full flex-col p-6 hover:-translate-y-1">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="mb-1.5 font-bold text-text">
                  {t(`tools.${key}.title`)}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-muted">
                  {t(`tools.${key}.description`)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 mochi-spring">
                  {t('tools.useNow')}
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-sm text-muted">
        {t('tools.moreComingSoon')}
      </p>
    </div>
  )
}
