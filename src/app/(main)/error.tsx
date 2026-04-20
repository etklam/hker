'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle size={32} className="text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-text mb-2">
          {t('common.errorTitle', 'Something went wrong')}
        </h2>
        <p className="text-sm text-muted max-w-md">
          {t('common.errorDescription', 'An unexpected error occurred. Please try again.')}
        </p>
      </div>
      <button
        onClick={reset}
        className="mochi-spring flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover active:scale-[0.98]"
      >
        <RotateCcw size={16} />
        {t('common.tryAgain', 'Try again')}
      </button>
    </div>
  )
}
