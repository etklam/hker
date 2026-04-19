'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { TodoCard } from './TodoCard'
import type { TodoListWithItems, TodoResponse, TodoPriority } from '@/lib/types'

interface Props {
  list: TodoListWithItems
  canManageLists: boolean
  onAddTodo: (data: { title: string; description?: string; priority?: TodoPriority; dueDate?: string; assignedTo?: number }) => void
  onEditTodo: (todo: TodoResponse) => void
  onToggleTodo: (todoId: number, completed: boolean) => void
  onDeleteList: () => void
  onUpdateListTitle: (title: string) => void
}

export function TodoColumn({
  list,
  canManageLists,
  onAddTodo,
  onEditTodo,
  onToggleTodo,
  onDeleteList,
  onUpdateListTitle,
}: Props) {
  const { t } = useTranslation()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(list.title)
  const [addingTodo, setAddingTodo] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const todoInputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `list-${list.id}` })

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `list-${list.id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (addingTodo) todoInputRef.current?.focus()
  }, [addingTodo])

  function commitTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== list.title) {
      onUpdateListTitle(trimmed)
    } else {
      setTitleDraft(list.title)
    }
    setEditingTitle(false)
  }

  function handleAddTodo() {
    const trimmed = newTodoTitle.trim()
    if (trimmed) {
      onAddTodo({ title: trimmed })
      setNewTodoTitle('')
    }
    setAddingTodo(false)
  }

  const todoIds = list.todos.map((todo) => `todo-${todo.id}`)

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`flex w-72 shrink-0 flex-col rounded-3xl border border-border bg-surface-strong/80 backdrop-blur-sm ${
        isDragging ? 'z-50 opacity-50 shadow-xl' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {canManageLists && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-1 text-muted/50 hover:text-muted active:cursor-grabbing"
            aria-label="Drag column"
          >
            <GripVertical size={14} />
          </button>
        )}

        {editingTitle && canManageLists ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') { setTitleDraft(list.title); setEditingTitle(false) }
            }}
            className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-sm font-bold text-text outline-none ring-1 ring-accent/30 focus:ring-accent"
          />
        ) : (
          <h3
            onClick={() => canManageLists && setEditingTitle(true)}
            className={`min-w-0 flex-1 truncate text-sm font-bold text-text ${canManageLists ? 'cursor-pointer hover:text-accent' : ''}`}
          >
            {list.title}
          </h3>
        )}

        <span className="text-xs text-muted">{list.todos.length}</span>

        {canManageLists && (
          <button
            onClick={() => { if (confirm(t('todo.deleteListConfirm'))) onDeleteList() }}
            className="rounded-full p-1 text-muted/50 hover:bg-red-500/10 hover:text-red-500 mochi-spring"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Todo list (droppable) */}
      <div ref={setDroppableRef} className="flex min-h-[60px] flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
          {list.todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onToggle={(completed) => onToggleTodo(todo.id, completed)}
              onEdit={() => onEditTodo(todo)}
            />
          ))}
        </SortableContext>

        {list.todos.length === 0 && (
          <p className="py-4 text-center text-xs text-muted/60">{t('todo.dragOrAdd')}</p>
        )}
      </div>

      {/* Add todo */}
      <div className="px-3 pb-3">
        {addingTodo ? (
          <input
            ref={todoInputRef}
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onBlur={handleAddTodo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTodo()
              if (e.key === 'Escape') { setNewTodoTitle(''); setAddingTodo(false) }
            }}
            placeholder={t('todo.addTodo')}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        ) : (
          <button
            onClick={() => setAddingTodo(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-muted hover:bg-accent-soft hover:text-accent mochi-spring"
          >
            <Plus size={14} />
            {t('todo.addTodo')}
          </button>
        )}
      </div>
    </div>
  )
}
