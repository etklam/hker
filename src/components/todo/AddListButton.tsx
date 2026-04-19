'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'

interface Props {
  onAdd: (title: string) => void
}

export function AddListButton({ onAdd }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function commit() {
    const trimmed = title.trim()
    if (trimmed) onAdd(trimmed)
    setTitle('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-12 w-72 shrink-0 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-sm font-medium text-muted hover:border-accent hover:text-accent mochi-spring"
      >
        <Plus size={18} />
        {t('todo.addList')}
      </button>
    )
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 rounded-3xl border border-border bg-surface-strong/80 p-4">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setTitle(''); setOpen(false) }
        }}
        placeholder={t('todo.editListTitle')}
        className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          onClick={commit}
          disabled={!title.trim()}
          className="flex-1 rounded-xl bg-cta px-3 py-2 text-sm font-bold text-white hover:bg-cta-hover disabled:opacity-50 mochi-spring"
        >
          {t('todo.addList')}
        </button>
        <button
          onClick={() => { setTitle(''); setOpen(false) }}
          className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-accent-soft hover:text-text mochi-spring"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
