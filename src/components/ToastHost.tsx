'use client'

import React, { useEffect, useState, useCallback } from 'react'
import type { ToastType } from '@/lib/toast'

interface Toast {
  id: number
  message: string
  type: ToastType
  leaving: boolean
}

let nextId = 0

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-accent text-white',
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350)
  }, [])

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent).detail as { message: string; type: ToastType }
      const id = ++nextId
      setToasts(prev => [...prev, { id, message, type, leaving: false }])
      setTimeout(() => dismiss(id), 3000)
    }
    window.addEventListener('push-toast', handler)
    return () => window.removeEventListener('push-toast', handler)
  }, [dismiss])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto mochi-spring rounded-2xl px-5 py-3 shadow-lg text-sm font-medium ${typeStyles[t.type]} ${
            t.leaving ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100'
          }`}
          onClick={() => dismiss(t.id)}
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
