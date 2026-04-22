'use client'

import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { TodoColumn } from './TodoColumn'
import { TodoCard } from './TodoCard'
import { AddListButton } from './AddListButton'
import type { TodoListWithItems, TodoResponse, TodoPriority } from '@/lib/types'

interface Props {
  lists: TodoListWithItems[]
  canManageLists: boolean
  onReorderLists: (ids: number[]) => void
  onReorderTodos: (listId: number, ids: number[]) => void
  onMoveTodo: (todoId: number, targetListId: number) => void
  onAddTodo: (listId: number, data: { title: string; description?: string; priority?: TodoPriority; dueDate?: string; assignedTo?: number }) => void
  onOpenCreate: (listId: number) => void
  onAddList: (title: string) => void
  onEditTodo: (todo: TodoResponse) => void
  onToggleTodo: (todoId: number, completed: boolean) => void
  onDeleteList: (listId: number) => void
  onUpdateListTitle: (listId: number, title: string) => void
}

function parseId(dndId: string): { type: 'list' | 'todo'; id: number } {
  if (dndId.startsWith('list-')) return { type: 'list', id: Number(dndId.slice(5)) }
  if (dndId.startsWith('todo-')) return { type: 'todo', id: Number(dndId.slice(5)) }
  return { type: 'list', id: Number(dndId) }
}

function findListByTodoId(lists: TodoListWithItems[], todoId: number): TodoListWithItems | undefined {
  return lists.find((l) => l.todos.some((t) => t.id === todoId))
}

export function TodoBoard({
  lists,
  canManageLists,
  onReorderLists,
  onReorderTodos,
  onMoveTodo,
  onAddTodo,
  onOpenCreate,
  onAddList,
  onEditTodo,
  onToggleTodo,
  onDeleteList,
  onUpdateListTitle,
}: Props) {
  const { t } = useTranslation()
  const [activeItem, setActiveItem] = useState<{ type: 'list' | 'todo'; id: number } | null>(null)
  const [localLists, setLocalLists] = useState(lists)

  // Keep localLists in sync with parent prop
  React.useEffect(() => { setLocalLists(lists) }, [lists])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeTodo = activeItem?.type === 'todo'
    ? localLists.flatMap((l) => l.todos).find((t) => t.id === activeItem.id)
    : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveItem(parseId(String(event.active.id)))
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeInfo = parseId(String(active.id))
    const overInfo = parseId(String(over.id))

    // Only handle cross-column todo moves during dragOver
    if (activeInfo.type !== 'todo') return

    const sourceList = findListByTodoId(localLists, activeInfo.id)
    let targetListId: number | undefined

    if (overInfo.type === 'list') {
      targetListId = overInfo.id
    } else if (overInfo.type === 'todo') {
      const targetList = findListByTodoId(localLists, overInfo.id)
      targetListId = targetList?.id
    }

    if (!sourceList || !targetListId || sourceList.id === targetListId) return

    // Move todo to target column in local state for preview
    setLocalLists((prev) => {
      const next = prev.map((l) => ({ ...l, todos: [...l.todos] }))
      const srcIdx = next.findIndex((l) => l.id === sourceList.id)
      const dstIdx = next.findIndex((l) => l.id === targetListId)
      if (srcIdx === -1 || dstIdx === -1) return prev

      const todoIdx = next[srcIdx].todos.findIndex((t) => t.id === activeInfo.id)
      if (todoIdx === -1) return prev

      const [moved] = next[srcIdx].todos.splice(todoIdx, 1)
      // Insert at position of overInfo todo, or at end
      if (overInfo.type === 'todo') {
        const overIdx = next[dstIdx].todos.findIndex((t) => t.id === overInfo.id)
        next[dstIdx].todos.splice(overIdx >= 0 ? overIdx : next[dstIdx].todos.length, 0, moved)
      } else {
        next[dstIdx].todos.push(moved)
      }

      return next
    })
  }, [localLists])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over) {
      setLocalLists(lists) // reset
      return
    }

    const activeInfo = parseId(String(active.id))
    const overInfo = parseId(String(over.id))

    if (activeInfo.type === 'list' && canManageLists) {
      // Reorder columns
      const oldIdx = localLists.findIndex((l) => l.id === activeInfo.id)
      const newIdx = localLists.findIndex((l) => l.id === overInfo.id)
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(localLists, oldIdx, newIdx)
        setLocalLists(reordered)
        onReorderLists(reordered.map((l) => l.id))
      }
      return
    }

    if (activeInfo.type === 'todo') {
      // Find where the todo currently sits (after dragOver updates)
      const currentList = findListByTodoId(localLists, activeInfo.id)
      const originalList = findListByTodoId(lists, activeInfo.id)

      if (!currentList) return

      // Cross-column move
      if (originalList && currentList.id !== originalList.id) {
        onMoveTodo(activeInfo.id, currentList.id)
        // Also reorder within the new column
        onReorderTodos(currentList.id, currentList.todos.map((t) => t.id))
        return
      }

      // Same-column reorder
      if (overInfo.type === 'todo') {
        const oldIdx = currentList.todos.findIndex((t) => t.id === activeInfo.id)
        const newIdx = currentList.todos.findIndex((t) => t.id === overInfo.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(currentList.todos, oldIdx, newIdx)
          setLocalLists((prev) =>
            prev.map((l) => (l.id === currentList.id ? { ...l, todos: reordered } : l)),
          )
          onReorderTodos(currentList.id, reordered.map((t) => t.id))
        }
      }
    }
  }, [localLists, lists, canManageLists, onReorderLists, onMoveTodo, onReorderTodos])

  const listIds = localLists.map((l) => `list-${l.id}`)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
          {localLists.map((list) => (
            <TodoColumn
              key={list.id}
              list={list}
              canManageLists={canManageLists}
              onAddTodo={(data) => onAddTodo(list.id, data)}
              onOpenCreate={() => onOpenCreate(list.id)}
              onEditTodo={onEditTodo}
              onToggleTodo={onToggleTodo}
              onDeleteList={() => onDeleteList(list.id)}
              onUpdateListTitle={(title) => onUpdateListTitle(list.id, title)}
            />
          ))}
        </SortableContext>

        {canManageLists && <AddListButton onAdd={onAddList} />}
      </div>

      <DragOverlay>
        {activeTodo ? (
          <div className="rotate-3 scale-105">
            <TodoCard
              todo={activeTodo}
              onToggle={() => {}}
              onEdit={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
