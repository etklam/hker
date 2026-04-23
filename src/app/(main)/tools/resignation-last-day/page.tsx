'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Calendar, AlertCircle } from 'lucide-react'
import { calculateLastDay, type ResignationMode, type ResignationResult } from '@/lib/tools/resignation'

function formatDate(date: Date, lang: string): string {
  const locale = lang === 'zh-HK' ? 'zh-HK' : 'en-GB'
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ResignationPage() {
  const { t, i18n } = useTranslation()
  const [resignationDate, setResignationDate] = useState('')
  const [mode, setMode] = useState<ResignationMode>('days')
  const [noticeValue, setNoticeValue] = useState('30')
  const [result, setResult] = useState<ResignationResult | null>(null)

  useEffect(() => {
    if (!resignationDate || !noticeValue) {
      setResult(null)
      return
    }
    const value = parseInt(noticeValue, 10)
    if (isNaN(value) || value <= 0) {
      setResult(null)
      return
    }
    try {
      const r = calculateLastDay({
        resignationDate: new Date(resignationDate + 'T00:00:00'),
        mode,
        value,
      })
      setResult(r)
    } catch {
      setResult(null)
    }
  }, [resignationDate, mode, noticeValue])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Back link */}
      <Link
        href="/tools"
        className="mochi-spring mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={16} />
        {t('tools.backToTools')}
      </Link>

      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-accent">
          <Calendar size={32} strokeWidth={2} />
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-text sm:text-4xl">
          {t('tools.resignation.title')}
        </h1>
        <p className="mt-2 text-muted">{t('tools.resignation.description')}</p>
      </div>

      {/* Main content: Input + Result side by side on desktop */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        {/* Input Card */}
        <div className="mochi-card p-6">
          <div className="space-y-5">
            {/* Resignation date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t('tools.resignation.resignationDate')}
              </label>
              <input
                type="date"
                value={resignationDate}
                onChange={(e) => setResignationDate(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            {/* Notice mode */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t('tools.resignation.noticeMode')}
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ResignationMode)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              >
                <option value="days">{t('tools.resignation.modeDays')}</option>
                <option value="months">{t('tools.resignation.modeMonths')}</option>
              </select>
            </div>

            {/* Notice value */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                {t('tools.resignation.noticePeriod')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={noticeValue}
                  onChange={(e) => setNoticeValue(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                />
                <span className="shrink-0 text-sm text-muted">
                  {mode === 'days' ? t('tools.resignation.noticeDaysUnit') : t('tools.resignation.noticeMonthsUnit')}
                </span>
              </div>
              {mode === 'months' && (
                <p className="mt-2 text-xs text-muted">{t('tools.resignation.monthNote')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Result Card */}
        <div className="mochi-card p-6">
          {!result ? (
            <div className="flex h-full min-h-[160px] items-center justify-center text-center text-muted">
              <p className="text-sm">{t('tools.resignation.emptyState')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                {t('tools.resignation.results.title')}
              </h2>
              {/* Result sentence */}
              <p className="text-lg font-bold text-text">
                {t('tools.resignation.resultSentence', {
                  date: formatDate(result.lastWorkingDay, i18n.language),
                })}
              </p>
              {/* Detail rows */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm text-muted">{t('tools.resignation.results.lastWorkingDay')}</span>
                  <span className="text-right font-semibold text-text">
                    {formatDate(result.lastWorkingDay, i18n.language)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm text-muted">{t('tools.resignation.results.noticeEndDate')}</span>
                  <span className="text-right font-semibold text-text">
                    {formatDate(result.noticeEndDate, i18n.language)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer Card */}
      <div className="mochi-card p-5">
        <div className="flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-muted" strokeWidth={2} />
          <p className="text-sm text-muted">{t('tools.resignation.disclaimer')}</p>
        </div>
      </div>
    </div>
  )
}
