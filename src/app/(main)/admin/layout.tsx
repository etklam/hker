'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { Shield, Users, BarChart3, ArrowLeft } from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin', labelKey: 'admin.dashboard', icon: BarChart3 },
  { href: '/admin/users', labelKey: 'admin.users', icon: Users },
] as const

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Shield size={48} className="text-muted" />
        <p className="text-lg text-muted">{t('admin.noAccess')}</p>
        <Link href="/" className="text-accent hover:underline">
          {t('common.back')}
        </Link>
      </div>
    )
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Admin header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="mochi-spring flex items-center gap-1 text-sm text-muted hover:text-text"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-accent" />
          <h1 className="text-xl font-bold text-text">{t('admin.title')}</h1>
        </div>
      </div>

      {/* Admin nav */}
      <nav className="mb-8 flex items-center gap-2 border-b border-border pb-3">
        {ADMIN_NAV.map(({ href, labelKey, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`mochi-spring flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive(href)
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:text-text hover:bg-accent-soft/50'
            }`}
          >
            <Icon size={16} strokeWidth={2.5} />
            {t(labelKey)}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}
