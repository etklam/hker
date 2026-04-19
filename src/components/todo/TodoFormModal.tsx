'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Trash2 } from 'lucide-react'
import type { TodoResponse, TodoPriority } from '@/lib/types'

interface Props {
  todo?: TodoResponse
  onClose: () => void
  onSave: (data: {
    title: string
    description?: string | null
    priority?: TodoPriority
    dueDate?: string | null
    assignedTo?: number | null
  }) => void
  onDelete?: () => void
}

const PRIORITIES: TodoPriority[] = ['low', 'medium', 'high', 'urgent']

export function TodoFormModal({ todo, onClose, onSave, onDelete }: Props) {
  const { t } = useTranslation()
  const isEdit = !!todo

  const [title, setTitle] = useState(todo?.title ?? '')
  const [description, setDescription] = useState(todo?.description ?? '')
  const [priority, setPriority] = useState<TodoPriority>(todo?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(todo?.dueDate?.slice(0, 10) ?? '')
  const [assignedTo, setAssignedTo] = useState(todo?.assignedTo?.id?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      onSave({
        title: trimmed,
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
        assignedTo: assignedTo ? Number(assignedTo) : null,
      })
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!onDelete) return
    if (confirm(t('todo.delete_confirm'))) onDelete()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mochi-card mx-4 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text">
            {isEdit ? t('todo.editTodo') : t('todo.createTodo')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent active:scale-95 mochi-spring"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t('todo.labels.title')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
              autoFocus
              required
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t('todo.labels.description')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
            />
          </label>

          {/* Priority */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t('todo.labels.priority')}</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`todo.priority.${p}`)}</option>
              ))}
            </select>
          </label>

          {/* Due Date */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t('todo.labels.dueDate')}</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
            />
          </label>

          {/* Assign to */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t('todo.labels.assignTo')}</span>
            <input
              type="number"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-text outline-none transition-colors focus:border-accent"
              min={1}
            />
          </label>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 mochi-spring"
              >
                <Trash2 size={14} />
                {t('todo.labels.delete')}
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-accent-soft hover:text-text mochi-spring"
            >
              {t('todo.labels.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-xl bg-cta px-5 py-2.5 text-sm font-bold text-white hover:bg-cta-hover hover:scale-105 active:scale-95 disabled:opacity-50 mochi-spring"
            >
              {t('todo.labels.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
