'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useTheme, THEMES, type Theme } from '@/lib/theme'
import {
  Home,
  Bookmark,
  Store,
  CheckSquare,
  Sun,
  Moon,
  Leaf,
  Globe,
  LogOut,
  LogIn,
  Menu,
  X,
  Shield,
} from 'lucide-react'
import { ToastHost } from '@/components/ToastHost'

const themeIcons: Record<Theme, React.ReactNode> = {
  light: <Sun size={18} strokeWidth={2.5} />,
  dark: <Moon size={18} strokeWidth={2.5} />,
  eye: <Leaf size={18} strokeWidth={2.5} />,
}

const NAV_ITEMS = [
  { href: '/', labelKey: 'home.brand', icon: Home },
  { href: '/me/collections', labelKey: 'nav.myCollections', icon: Bookmark },
  { href: '/marketplace', labelKey: 'nav.marketplace', icon: Store },
  { href: '/spaces', labelKey: 'nav.spaces', icon: CheckSquare },
] as const

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t, i18n } = useTranslation()
  const { user, loading, logout } = useAuth()
  const [theme, setTheme] = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  function cycleTheme() {
    const idx = THEMES.indexOf(theme)
    setTheme(THEMES[(idx + 1) % THEMES.length])
  }

  function toggleLang() {
    const next = i18n.language === 'zh-HK' ? 'en' : 'zh-HK'
    i18n.changeLanguage(next)
    try { localStorage.setItem('lang', next) } catch { /* ignore */ }
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Top Nav ─── */}
      <header className="sticky top-0 z-40 bg-surface backdrop-blur-xl border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-xl font-bold text-accent mochi-spring hover:scale-105"
          >
            HKER
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`mochi-spring flex items-center gap-2 rounded-full min-h-[44px] px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:text-text hover:bg-accent-soft/50'
                }`}
              >
                <Icon size={16} strokeWidth={2.5} />
                {href === '/' ? 'HKER' : t(labelKey)}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className={`mochi-spring flex items-center gap-2 rounded-full min-h-[44px] px-4 py-3 text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:text-text hover:bg-accent-soft/50'
                }`}
              >
                <Shield size={16} strokeWidth={2.5} />
                {t('admin.nav')}
              </Link>
            )}
          </nav>

          {/* Right controls */}
          <div className="hidden md:flex items-center gap-2">
            {/* Theme */}
            <button
              onClick={cycleTheme}
              title={t(`theme.${theme}`)}
              className="mochi-spring flex items-center justify-center rounded-full size-11 text-muted hover:text-text hover:bg-accent-soft active:scale-95"
              aria-label={t('theme.label')}
            >
              {themeIcons[theme]}
            </button>

            {/* Language */}
            <button
              onClick={toggleLang}
              title={t('common.language')}
              className="mochi-spring flex items-center justify-center rounded-full size-11 text-muted hover:text-text hover:bg-accent-soft active:scale-95"
              aria-label={t('common.language')}
            >
              <Globe size={18} strokeWidth={2.5} />
            </button>

            {/* Auth */}
            {!loading && (
              user ? (
                <button
                  onClick={() => logout()}
                  className="mochi-spring flex items-center gap-2 rounded-full min-h-[44px] px-4 py-3 text-sm font-medium text-muted hover:text-text hover:bg-accent-soft active:scale-95"
                >
                  <LogOut size={16} strokeWidth={2.5} />
                  {t('common.logout')}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="mochi-spring flex items-center gap-2 rounded-full min-h-[44px] bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-hover active:scale-95"
                >
                  <LogIn size={16} strokeWidth={2.5} />
                  {t('common.login')}
                </Link>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? t('common.closeMenu') : t('common.openMenu')}
            className="md:hidden mochi-spring flex items-center justify-center rounded-full size-11 text-muted hover:text-text hover:bg-accent-soft active:scale-95"
          >
            {mobileOpen ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
          </button>
        </div>

        {/* ─── Mobile Dropdown ─── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-surface backdrop-blur-xl">
            <nav className="flex flex-col gap-1 px-4 py-3">
              {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`mochi-spring flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ${
                    isActive(href)
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:text-text hover:bg-accent-soft/50'
                  }`}
                >
                  <Icon size={18} strokeWidth={2.5} />
                  {href === '/' ? 'HKER' : t(labelKey)}
                </Link>
              ))}
              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={`mochi-spring flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ${
                    isActive('/admin')
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:text-text hover:bg-accent-soft/50'
                  }`}
                >
                  <Shield size={18} strokeWidth={2.5} />
                  {t('admin.nav')}
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              <button
                onClick={cycleTheme}
                aria-label={t('theme.label')}
                className="mochi-spring flex items-center justify-center rounded-full size-11 text-muted hover:text-text hover:bg-accent-soft active:scale-95"
              >
                {themeIcons[theme]}
              </button>
              <button
                onClick={toggleLang}
                aria-label={t('common.language')}
                className="mochi-spring flex items-center justify-center rounded-full size-11 text-muted hover:text-text hover:bg-accent-soft active:scale-95"
              >
                <Globe size={18} strokeWidth={2.5} />
              </button>
              <div className="flex-1" />
              {!loading && (
                user ? (
                  <button
                    onClick={() => { logout(); setMobileOpen(false) }}
                    className="mochi-spring flex items-center gap-2 rounded-full min-h-[44px] px-4 py-3 text-sm font-medium text-muted hover:text-text hover:bg-accent-soft active:scale-95"
                  >
                    <LogOut size={16} strokeWidth={2.5} />
                    {t('common.logout')}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="mochi-spring flex items-center gap-2 rounded-full min-h-[44px] bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-hover active:scale-95"
                  >
                    <LogIn size={16} strokeWidth={2.5} />
                    {t('common.login')}
                  </Link>
                )
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─── Content ─── */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        {children}
      </main>

      <ToastHost />
    </div>
  )
}
