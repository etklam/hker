'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { GripVertical, Calendar, Check } from 'lucide-react'
import type { TodoResponse, TodoPriority } from '@/lib/types'

const priorityBg: Record<TodoPriority, string> = {
  low: 'bg-accent-soft',
  medium: 'bg-emerald-500/10',
  high: 'bg-pink-500/10',
  urgent: 'bg-red-500/10',
}

const priorityBadge: Record<TodoPriority, string> = {
  low: 'bg-accent-soft text-accent',
  medium: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  high: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  urgent: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

interface Props {
  todo: TodoResponse
  onToggle: (completed: boolean) => void
  onEdit: () => void
}

export function TodoCard({ todo, onToggle, onEdit }: Props) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `todo-${todo.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl border border-border/50 p-3 shadow-sm mochi-spring ${priorityBg[todo.priority]} ${
        isDragging ? 'z-50 opacity-50 shadow-lg' : ''
      } ${todo.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted/50 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical size={14} />
        </button>

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(!todo.completed) }}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 mochi-spring ${
            todo.completed
              ? 'border-pink-400 bg-pink-400 text-white'
              : 'border-muted/40 hover:border-accent'
          }`}
        >
          {todo.completed && <Check size={12} strokeWidth={3} />}
        </button>

        {/* Content */}
        <button
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={`text-sm font-medium leading-snug text-text ${
              todo.completed ? 'line-through decoration-pink-300 decoration-2' : ''
            }`}
          >
            {todo.title}
          </p>
          {todo.description && (
            <p className="mt-0.5 text-xs text-muted line-clamp-2">
              {todo.description}
            </p>
          )}
        </button>
      </div>

      {/* Footer: priority badge, due date, assignee */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[52px]">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityBadge[todo.priority]}`}>
          {t(`todo.priority.${todo.priority}`)}
        </span>

        {todo.dueDate && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
            <Calendar size={10} />
            {new Date(todo.dueDate).toLocaleDateString()}
          </span>
        )}

        {todo.assignedTo && (
          <span className="flex items-center gap-1">
            {todo.assignedTo.avatarUrl ? (
              <img
                src={todo.assignedTo.avatarUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-[8px] font-bold text-accent">
                {(todo.assignedTo.displayName || todo.assignedTo.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
