'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  calculateMortgageModeA,
  calculateMortgageModeB,
} from '@/lib/tools/mortgage'
import type { MortgageResult } from '@/lib/tools/mortgage'

type MortgageMode = 'A' | 'B'

function formatHKD(amount: number): string {
  return 'HK$' + amount.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function MortgagePage() {
  const { t } = useTranslation()

  const [mode, setMode] = useState<MortgageMode>('A')
  const [propertyPrice, setPropertyPrice] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [targetMonthly, setTargetMonthly] = useState('')
  const [annualRate, setAnnualRate] = useState('3.5')
  const [tenureYears, setTenureYears] = useState('25')
  const [maxLtv, setMaxLtv] = useState('')
  const [result, setResult] = useState<MortgageResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setResult(null)
    setErrors({})
  }, [mode])

  useEffect(() => {
    const pp = parseFloat(propertyPrice)
    const rate = parseFloat(annualRate)
    const tenure = parseFloat(tenureYears)

    if (!propertyPrice || isNaN(pp) || pp <= 0) {
      setResult(null)
      setErrors({})
      return
    }

    if (!tenureYears || isNaN(tenure) || tenure <= 0) {
      setErrors({ tenureYears: t('tools.mortgage.errors.tenureRequired') })
      setResult(null)
      return
    }

    if (mode === 'A') {
      const dp = parseFloat(downPayment)
      if (!isNaN(dp) && dp > pp) {
        setErrors({ downPayment: t('tools.mortgage.errors.downPaymentExceeds') })
        setResult(null)
        return
      }
      setErrors({})
      setResult(
        calculateMortgageModeA({
          propertyPrice: pp,
          downPayment: isNaN(dp) ? 0 : dp,
          annualRate: isNaN(rate) ? 0 : rate,
          tenureYears: tenure,
        }),
      )
    } else {
      const tm = parseFloat(targetMonthly)
      if (!targetMonthly || isNaN(tm) || tm <= 0) {
        setResult(null)
        setErrors({})
        return
      }
      const ltv = parseFloat(maxLtv)
      setErrors({})
      setResult(
        calculateMortgageModeB({
          propertyPrice: pp,
          targetMonthlyPayment: tm,
          annualRate: isNaN(rate) ? 0 : rate,
          tenureYears: tenure,
          maxLtvPercent: isNaN(ltv) ? undefined : ltv,
        }),
      )
    }
  }, [mode, propertyPrice, downPayment, targetMonthly, annualRate, tenureYears, maxLtv, t])

  const inputClass =
    'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all'
  const labelClass = 'mb-1 block text-sm font-medium text-text'

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link href="/tools" className="mochi-spring mb-6 inline-block text-sm text-muted hover:text-text">
        {t('tools.backToTools')}
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">{t('tools.mortgage.title')}</h1>
        <p className="mt-2 text-muted">{t('tools.mortgage.description')}</p>
      </div>

      <div className="mb-6 flex rounded-2xl border border-border bg-surface-strong p-1">
        <button
          onClick={() => setMode('A')}
          className={`mochi-spring flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            mode === 'A' ? 'bg-accent text-white' : 'text-muted hover:text-text'
          }`}
        >
          {t('tools.mortgage.modeA')}
        </button>
        <button
          onClick={() => setMode('B')}
          className={`mochi-spring flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            mode === 'B' ? 'bg-accent text-white' : 'text-muted hover:text-text'
          }`}
        >
          {t('tools.mortgage.modeB')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Input Card */}
        <div className="mochi-card p-6">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('tools.mortgage.propertyPrice')}</label>
              <input
                type="number"
                value={propertyPrice}
                onChange={(e) => setPropertyPrice(e.target.value)}
                className={inputClass}
                placeholder="5000000"
                min="0"
              />
            </div>

            {mode === 'A' && (
              <div>
                <label className={labelClass}>{t('tools.mortgage.downPayment')}</label>
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                  className={inputClass}
                  placeholder="1000000"
                  min="0"
                />
                {errors.downPayment && (
                  <p className="mt-1 text-xs text-red-500">{errors.downPayment}</p>
                )}
              </div>
            )}

            {mode === 'B' && (
              <div>
                <label className={labelClass}>{t('tools.mortgage.targetMonthly')}</label>
                <input
                  type="number"
                  value={targetMonthly}
                  onChange={(e) => setTargetMonthly(e.target.value)}
                  className={inputClass}
                  placeholder="15000"
                  min="0"
                />
              </div>
            )}

            <div>
              <label className={labelClass}>{t('tools.mortgage.annualRate')}</label>
              <input
                type="number"
                step="0.01"
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
                className={inputClass}
                placeholder="3.5"
                min="0"
              />
            </div>

            <div>
              <label className={labelClass}>{t('tools.mortgage.tenureYears')}</label>
              <input
                type="number"
                value={tenureYears}
                onChange={(e) => setTenureYears(e.target.value)}
                className={inputClass}
                placeholder="25"
                min="1"
              />
              {errors.tenureYears && (
                <p className="mt-1 text-xs text-red-500">{errors.tenureYears}</p>
              )}
            </div>

            {mode === 'B' && (
              <div>
                <label className={labelClass}>
                  {t('tools.mortgage.maxLtv')}
                  <span className="ml-1 text-xs text-muted">({t('tools.mortgage.optional')})</span>
                </label>
                <input
                  type="number"
                  value={maxLtv}
                  onChange={(e) => setMaxLtv(e.target.value)}
                  className={inputClass}
                  placeholder="90"
                  min="0"
                  max="100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Result Card */}
        <div className="mochi-card p-6">
          {!result ? (
            <p className="py-8 text-center text-sm text-muted">
              {t('tools.mortgage.results.placeholder')}
            </p>
          ) : (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-text">
                {t('tools.mortgage.results.title')}
              </h2>

              {mode === 'A' ? (
                <>
                  <div className="mb-4 rounded-2xl bg-accent-soft p-4 text-center">
                    <p className="mb-1 text-xs text-muted">
                      {t('tools.mortgage.results.monthlyPayment')}
                    </p>
                    <p className="text-2xl font-bold text-accent">
                      {formatHKD(result.monthlyPayment)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <span className="text-sm text-muted">{t('tools.mortgage.results.loanAmount')}</span>
                    <span className="font-semibold text-text">{formatHKD(result.loanAmount)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <span className="text-sm text-muted">{t('tools.mortgage.results.totalInterest')}</span>
                    <span className="font-semibold text-text">{formatHKD(result.totalInterest)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-sm text-muted">{t('tools.mortgage.results.totalPayment')}</span>
                    <span className="font-semibold text-text">{formatHKD(result.totalPayment)}</span>
                  </div>
                </>
              ) : (
                <>
                  {result.fullCoverage && (
                    <p className="mb-3 text-sm text-accent">
                      {t('tools.mortgage.results.fullCoverage')}
                    </p>
                  )}
                  <div className="mb-4 rounded-2xl bg-accent-soft p-4 text-center">
                    <p className="mb-1 text-xs text-muted">
                      {t('tools.mortgage.results.requiredDownPayment')}
                    </p>
                    <p className="text-2xl font-bold text-accent">
                      {formatHKD(result.requiredDownPayment ?? 0)}
                    </p>
                  </div>
                  {result.exceedsLtv && (
                    <div className="mb-3 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-600">
                      {t('tools.mortgage.results.exceedsLtv')}
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <span className="text-sm text-muted">
                      {t('tools.mortgage.results.downPaymentPercent')}
                    </span>
                    <span className="font-semibold text-text">
                      {result.downPaymentPercent !== undefined
                        ? result.downPaymentPercent.toFixed(1) + '%'
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <span className="text-sm text-muted">
                      {t('tools.mortgage.results.monthlyPayment')}
                    </span>
                    <span className="font-semibold text-text">{formatHKD(result.monthlyPayment)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <span className="text-sm text-muted">{t('tools.mortgage.results.loanAmount')}</span>
                    <span className="font-semibold text-text">{formatHKD(result.loanAmount)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <span className="text-sm text-muted">{t('tools.mortgage.results.totalInterest')}</span>
                    <span className="font-semibold text-text">{formatHKD(result.totalInterest)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-sm text-muted">{t('tools.mortgage.results.totalPayment')}</span>
                    <span className="font-semibold text-text">{formatHKD(result.totalPayment)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notes / Disclaimer */}
      <div className="mochi-card mt-6 p-6">
        <p className="text-sm text-muted">{t('tools.mortgage.disclaimer')}</p>
      </div>
    </div>
  )
}
