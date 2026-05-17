'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api-client'
import { pushToast } from '@/lib/toast'
import { ArrowLeft, Loader2, Users, Link2 } from 'lucide-react'
import { TodoBoard } from '@/components/todo/TodoBoard'
import { TodoFormModal } from '@/components/todo/TodoFormModal'
import type {
  BoardResponse,
  TodoListWithItems,
  TodoResponse,
  TodoPriority,
  SpaceSpace,
  Member,
  InviteLink,
} from '@/lib/types'

export default function SpaceBoardPage() {
  const { t } = useTranslation()
  const params = useParams<{ sid: string }>()
  const sid = Number(params.sid)

  const [space, setSpace] = useState<SpaceSpace | null>(null)
  const [lists, setLists] = useState<TodoListWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTodo, setEditingTodo] = useState<TodoResponse | null>(null)
  const [showCreateTodo, setShowCreateTodo] = useState<{ listId: number } | null>(null)

  // Members & invites management
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<InviteLink[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)

  const canManageLists = space?.role === 'owner' || space?.role === 'admin'
  const isAdmin = canManageLists

  const loadBoard = useCallback(async () => {
    if (isNaN(sid)) notFound()
    try {
      const data = await api<BoardResponse>(`/api/spaces/spaces/${sid}/board`)
      setSpace(data.space)
      setLists(data.lists)
    } catch (e: unknown) {
      const err = e as { status?: number }
      if (err.status === 404) notFound()
      pushToast(t('todo.errors.loadBoard'), 'error')
    } finally {
      setLoading(false)
    }
  }, [sid, t])

  useEffect(() => { loadBoard() }, [loadBoard])

  // ─── Optimistic helpers ───

  async function handleReorderLists(ids: number[]) {
    const snapshot = structuredClone(lists)
    // Optimistic update so the parent `lists` ref stays in sync with localLists
    setLists((prev) => {
      const listMap = new Map(prev.map((l) => [l.id, l]))
      return ids.map((id) => listMap.get(id)!).filter(Boolean)
    })
    try {
      await api(`/api/spaces/spaces/${sid}/lists/reorder`, {
        method: 'PATCH',
        body: { ids },
      })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.reorderLists'), 'error')
    }
  }

  async function handleReorderTodos(listId: number, ids: number[]) {
    const snapshot = structuredClone(lists)
    // Optimistic update so the parent `lists` ref stays in sync with localLists
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l
        const todoMap = new Map(l.todos.map((t) => [t.id, t]))
        return { ...l, todos: ids.map((id) => todoMap.get(id)!).filter(Boolean) }
      }),
    )
    try {
      await api(`/api/spaces/lists/${listId}/todos/reorder`, {
        method: 'PATCH',
        body: { ids },
      })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.reorderTodos'), 'error')
    }
  }

  async function handleMoveTodo(todoId: number, targetListId: number) {
    const snapshot = structuredClone(lists)
    try {
      await api(`/api/spaces/todos/${todoId}/move`, {
        method: 'PATCH',
        body: { targetListId },
      })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.moveTodo'), 'error')
    }
  }

  async function handleAddTodo(
    listId: number,
    data: { title: string; description?: string; priority?: TodoPriority; dueDate?: string; assignedTo?: number },
  ) {
    try {
      const todo = await api<TodoResponse>(`/api/spaces/lists/${listId}/todos`, {
        method: 'POST',
        body: data,
      })
      setLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, todos: [...l.todos, todo] } : l)),
      )
    } catch {
      pushToast(t('todo.errors.saveTodo'), 'error')
    }
  }

  async function handleAddList(title: string) {
    try {
      const list = await api<TodoListWithItems>(`/api/spaces/spaces/${sid}/lists`, {
        method: 'POST',
        body: { title },
      })
      setLists((prev) => [...prev, { ...list, todos: list.todos ?? [] }])
    } catch {
      pushToast(t('todo.errors.addList'), 'error')
    }
  }

  async function handleToggleTodo(todoId: number, completed: boolean) {
    const snapshot = structuredClone(lists)
    // Optimistic update
    setLists((prev) =>
      prev.map((l) => ({
        ...l,
        todos: l.todos.map((t) => (t.id === todoId ? { ...t, completed } : t)),
      })),
    )
    try {
      await api(`/api/spaces/todos/${todoId}/complete`, {
        method: 'PATCH',
        body: { completed },
      })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.toggleTodo'), 'error')
    }
  }

  async function handleDeleteList(listId: number) {
    const snapshot = structuredClone(lists)
    setLists((prev) => prev.filter((l) => l.id !== listId))
    try {
      await api(`/api/spaces/spaces/${sid}/lists/${listId}`, { method: 'DELETE' })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.deleteList'), 'error')
    }
  }

  async function handleUpdateListTitle(listId: number, title: string) {
    const snapshot = structuredClone(lists)
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, title } : l)))
    try {
      await api(`/api/spaces/spaces/${sid}/lists/${listId}`, {
        method: 'PATCH',
        body: { title },
      })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.updateList'), 'error')
    }
  }

  async function handleSaveTodo(data: {
    title: string
    description?: string | null
    priority?: TodoPriority
    dueDate?: string | null
    assignedTo?: number | null
  }) {
    if (editingTodo) {
      // Update existing
      try {
        const updated = await api<TodoResponse>(`/api/spaces/todos/${editingTodo.id}`, {
          method: 'PATCH',
          body: data,
        })
        setLists((prev) =>
          prev.map((l) => ({
            ...l,
            todos: l.todos.map((t) => (t.id === editingTodo.id ? updated : t)),
          })),
        )
        setEditingTodo(null)
      } catch {
        pushToast(t('todo.errors.saveTodo'), 'error')
      }
    } else if (showCreateTodo) {
      // Create new todo with full form data (including priority)
      try {
        const todo = await api<TodoResponse>(`/api/spaces/lists/${showCreateTodo.listId}/todos`, {
          method: 'POST',
          body: {
            title: data.title,
            description: data.description ?? undefined,
            priority: data.priority,
            dueDate: data.dueDate ?? undefined,
            assignedTo: data.assignedTo ?? undefined,
          },
        })
        setLists((prev) =>
          prev.map((l) => (l.id === showCreateTodo.listId ? { ...l, todos: [...l.todos, todo] } : l)),
        )
        setShowCreateTodo(null)
      } catch {
        pushToast(t('todo.errors.saveTodo'), 'error')
      }
    }
  }

  async function handleDeleteTodo() {
    if (!editingTodo) return
    const snapshot = structuredClone(lists)
    setLists((prev) =>
      prev.map((l) => ({
        ...l,
        todos: l.todos.filter((t) => t.id !== editingTodo.id),
      })),
    )
    setEditingTodo(null)
    try {
      await api(`/api/spaces/todos/${editingTodo.id}`, { method: 'DELETE' })
    } catch {
      setLists(snapshot)
      pushToast(t('todo.errors.deleteTodo'), 'error')
    }
  }

  // ─── Members / Invites ───

  async function loadMembers() {
    setLoadingMembers(true)
    try {
      const [m, i] = await Promise.all([
        api<Member[]>(`/api/spaces/spaces/${sid}/members`),
        api<InviteLink[]>(`/api/spaces/spaces/${sid}/invites`),
      ])
      setMembers(m)
      setInvites(i)
    } catch {
      // errors are toasted by api-client
    } finally {
      setLoadingMembers(false)
    }
  }

  async function handleCreateInvite() {
    setCreatingInvite(true)
    try {
      const invite = await api<InviteLink>(`/api/spaces/spaces/${sid}/invites`, {
        method: 'POST',
        body: {},
      })
      setInvites((prev) => [...prev, invite])
    } catch {
      // toasted
    } finally {
      setCreatingInvite(false)
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!confirm(t('members.confirmRemove'))) return
    try {
      await api(`/api/spaces/spaces/${sid}/members/${memberId}`, { method: 'DELETE' })
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      // toasted
    }
  }

  async function handleDeleteInvite(inviteId: number) {
    if (!confirm(t('invites.confirmDelete'))) return
    try {
      await api(`/api/spaces/spaces/${sid}/invites/${inviteId}`, { method: 'DELETE' })
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } catch {
      // toasted
    }
  }

  async function handleCopyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      pushToast(t('invites.copySuccess'), 'success')
    } catch {
      pushToast(t('invites.errors.copy'), 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/spaces"
          className="flex items-center gap-1 text-sm text-muted hover:text-accent mochi-spring"
        >
          <ArrowLeft size={16} />
          {t('spaces.backSpaces')}
        </Link>

        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text">
          {space?.name}
        </h1>

        {space?.role && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            {space.role}
          </span>
        )}

        <div className="flex-1" />

        {isAdmin && (
          <button
            onClick={() => {
              setShowMembers((v) => !v)
              if (!showMembers) loadMembers()
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-text hover:border-accent mochi-spring"
          >
            <Users size={16} />
            {t('members.title')}
          </button>
        )}
      </div>

      {/* Members panel */}
      {showMembers && isAdmin && (
        <div className="mb-6 rounded-3xl border border-border bg-surface-strong/80 p-5">
          {loadingMembers ? (
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Members */}
              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-text mb-2">
                  {t('members.title')} ({members.length})
                </h3>
                <div className="flex flex-col gap-1.5">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-accent-soft/30">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                          {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="flex-1 truncate text-sm text-text">{m.displayName || m.email || `User ${m.userId}`}</span>
                      <span className="text-xs text-muted">{m.role}</span>
                      {m.role !== 'owner' && (
                        <button onClick={() => handleRemoveMember(m.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Invites */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-text">
                    {t('invites.title')}
                  </h3>
                  <button
                    onClick={handleCreateInvite}
                    disabled={creatingInvite}
                    className="rounded-lg bg-cta px-2.5 py-1 text-xs font-bold text-white hover:bg-cta-hover disabled:opacity-50 mochi-spring"
                  >
                    {creatingInvite ? <Loader2 size={12} className="animate-spin" /> : t('invites.create')}
                  </button>
                </div>
                {invites.length === 0 ? (
                  <p className="text-xs text-muted">{t('invites.empty')}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-accent-soft/30">
                        <Link2 size={12} className="text-muted" />
                        <span className="flex-1 truncate text-xs text-muted">{inv.url}</span>
                        <button onClick={() => handleCopyInvite(inv.url)} className="text-xs text-accent hover:text-accent-hover">
                          {t('invites.copy')}
                        </button>
                        <button onClick={() => handleDeleteInvite(inv.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Board */}
      <TodoBoard
        lists={lists}
        canManageLists={canManageLists}
        onReorderLists={handleReorderLists}
        onReorderTodos={handleReorderTodos}
        onMoveTodo={handleMoveTodo}
        onAddTodo={handleAddTodo}
        onOpenCreate={(listId) => setShowCreateTodo({ listId })}
        onAddList={handleAddList}
        onEditTodo={setEditingTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteList={handleDeleteList}
        onUpdateListTitle={handleUpdateListTitle}
      />

      {/* Edit modal */}
      {editingTodo && (
        <TodoFormModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={handleSaveTodo}
          onDelete={handleDeleteTodo}
        />
      )}

      {/* Create todo modal (with priority / full details) */}
      {showCreateTodo && (
        <TodoFormModal
          onClose={() => setShowCreateTodo(null)}
          onSave={handleSaveTodo}
        />
      )}
    </div>
  )
}
