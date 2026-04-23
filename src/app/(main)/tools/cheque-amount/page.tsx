'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, FileText } from 'lucide-react'
import {
  validateChequeAmount,
  convertToChequeAmount,
  formatHKD,
  type ChequeAmountResult,
} from '@/lib/tools/cheque-amount'

export default function ChequeAmountPage() {
  const { t } = useTranslation()
  const [amountInput, setAmountInput] = useState('')
  const [result, setResult] = useState<ChequeAmountResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<'zh' | 'en' | 'all' | null>(null)

  useEffect(() => {
    if (!amountInput.trim()) {
      setResult(null)
      setError(null)
      return
    }
    const validationError = validateChequeAmount(amountInput)
    if (validationError) {
      setError(validationError)
      setResult(null)
      return
    }
    setError(null)
    const amount = parseFloat(amountInput)
    setResult(convertToChequeAmount(amount))
  }, [amountInput])

  function copyToClipboard(text: string, key: typeof copiedKey) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
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
          <FileText size={32} strokeWidth={2} />
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-text sm:text-4xl">
          {t('tools.chequeAmount.title')}
        </h1>
        <p className="mt-2 text-muted">{t('tools.chequeAmount.description')}</p>
      </div>

      {/* Input Card */}
      <div className="mochi-card mb-6 p-6">
        <label className="mb-2 block text-sm font-medium text-text">
          {t('tools.chequeAmount.amountLabel')}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={t('tools.chequeAmount.amountPlaceholder')}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all text-xl font-mono"
        />
        {error && (
          <p className="mt-2 text-sm text-red-500">{t(error)}</p>
        )}
        {!error && amountInput && (
          <p className="mt-1 text-sm text-muted">{formatHKD(parseFloat(amountInput))}</p>
        )}
      </div>

      {/* Result Card */}
      {result && (
        <div className="mochi-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
            {t('tools.chequeAmount.results.title')}
          </h2>

          {/* Chinese result */}
          <div className="rounded-2xl bg-accent-soft p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted mb-1">{t('tools.chequeAmount.chinese')}</p>
                <p className="text-lg font-bold text-text break-all">{result.chinese}</p>
              </div>
              <button
                onClick={() => copyToClipboard(result.chinese, 'zh')}
                className="mochi-spring shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs text-muted hover:text-text hover:border-border-strong"
              >
                {copiedKey === 'zh' ? t('tools.chequeAmount.copied') : t('tools.chequeAmount.copyChinese')}
              </button>
            </div>
          </div>

          {/* English result */}
          <div className="rounded-2xl bg-accent-soft/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted mb-1">{t('tools.chequeAmount.english')}</p>
                <p className="font-medium text-text break-words">{result.english}</p>
              </div>
              <button
                onClick={() => copyToClipboard(result.english, 'en')}
                className="mochi-spring shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs text-muted hover:text-text hover:border-border-strong"
              >
                {copiedKey === 'en' ? t('tools.chequeAmount.copied') : t('tools.chequeAmount.copyEnglish')}
              </button>
            </div>
          </div>

          {/* Copy All button */}
          <button
            onClick={() => copyToClipboard(`${result.chinese}\n${result.english}`, 'all')}
            className="mochi-spring w-full rounded-2xl border border-border py-2 text-sm text-muted hover:text-text hover:border-border-strong"
          >
            {copiedKey === 'all' ? t('tools.chequeAmount.copied') : t('tools.chequeAmount.copyAll')}
          </button>
        </div>
      )}
    </div>
  )
}
