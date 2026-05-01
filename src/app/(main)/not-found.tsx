'use client'

import { useTranslation } from 'react-i18next'
import { SearchX } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/20">
        <SearchX size={32} className="text-muted" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-text mb-2">
          {t('common.notFoundTitle', 'Page not found')}
        </h2>
        <p className="text-sm text-muted max-w-md">
          {t('common.notFoundDescription', "The page you're looking for doesn't exist or has been moved.")}
        </p>
      </div>
      <Link
        href="/"
        className="mochi-spring flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover active:scale-[0.98]"
      >
        {t('common.goHome', 'Go home')}
      </Link>
    </div>
  )
}
