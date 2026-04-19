'use client'

import { Suspense, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { pushToast } from '@/lib/toast'

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function RegisterForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError(t('auth.errors.emailRequired'))
      return
    }
    if (password.length < 8 || password.length > 128) {
      setError(t('auth.errors.passwordLength'))
      return
    }

    setSubmitting(true)
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      })
      pushToast(t('auth.registerSuccess'), 'success')
      router.push(sanitizeReturnTo(searchParams.get('returnTo')))
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'CONFLICT') {
        setError(t('auth.errors.emailTaken'))
      } else {
        setError(t('auth.errors.register'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="mochi-card w-full max-w-md p-8 sm:p-10">
        <h1 className="mb-8 text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-accent">
          {t('auth.registerTitle')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-muted">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text placeholder:text-muted/50 focus:border-accent focus:outline-none mochi-spring"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-muted">
              {t('auth.displayName')}
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text placeholder:text-muted/50 focus:border-accent focus:outline-none mochi-spring"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-muted">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text placeholder:text-muted/50 focus:border-accent focus:outline-none mochi-spring"
            />
            <p className="mt-1 text-xs text-muted">{t('auth.passwordHint')}</p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mochi-spring w-full rounded-xl bg-accent py-3 font-medium text-white hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? t('common.saving') : t('auth.submitRegister')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover mochi-spring">
            {t('auth.submitLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
