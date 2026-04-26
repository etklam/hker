'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { pushToast } from '@/lib/toast'
import {
  calculateMonthlyBillSummary,
  formatHKD,
  getCurrentMonthKey,
  getRelativeMonthKey,
  isValidMonthKey,
  parseAmountToCents,
  type MonthlyBillStatus,
} from '@/lib/tools/monthly-bills'
import type {
  FamilyTodoSpace,
  MonthlyBillBoardResponse,
  MonthlyBillItemResponse,
  MonthlyBillListResponse,
} from '@/lib/types'

interface BillForm {
  name: string
  dueDay: string
  amount: string
  note: string
}

const emptyForm: BillForm = {
  name: '',
  dueDay: '1',
  amount: '',
  note: '',
}

const statusClasses: Record<MonthlyBillStatus, string> = {
  paid: 'bg-emerald-500/15 text-emerald-600',
  overdue: 'bg-red-500/15 text-red-500',
  dueToday: 'bg-amber-500/15 text-amber-600',
  upcoming: 'bg-accent-soft text-accent',
}

function monthParts(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split('-').map(Number)
  return { year, month }
}

function centsToInput(cents: number | null): string {
  if (cents === null) return ''
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

function formatDueDateLabel(dateKey: string, language: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (language === 'zh-HK') return `${month}月${day}日`

  return new Date(year, month - 1, day).toLocaleDateString('en-HK', {
    month: 'short',
    day: 'numeric',
  })
}

function formatMonthLabel(monthKey: string, language: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  if (language === 'zh-HK') return `${year}年${month}月`

  return new Date(year, month - 1, 1).toLocaleDateString('en-HK', {
    month: 'long',
    year: 'numeric',
  })
}

function spaceSelectValue(spaceId: number | null): string {
  return spaceId === null ? '' : String(spaceId)
}

export default function MonthlyBillsPage() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [month, setMonth] = useState(() => getCurrentMonthKey())
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [board, setBoard] = useState<MonthlyBillBoardResponse | null>(null)
  const [spaces, setSpaces] = useState<FamilyTodoSpace[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListSpaceId, setNewListSpaceId] = useState('')
  const [listDraftName, setListDraftName] = useState('')
  const [listDraftSpaceId, setListDraftSpaceId] = useState('')
  const [form, setForm] = useState<BillForm>(emptyForm)
  const [editingItem, setEditingItem] = useState<MonthlyBillItemResponse | null>(null)

  const activeList = board?.activeList ?? null
  const items = board?.items ?? []
  const canManageItems = activeList?.access === 'owner' || activeList?.access === 'admin'
  const canManageList = activeList?.access === 'owner'
  const summary = useMemo(() => calculateMonthlyBillSummary(items), [items])

  const loadBoard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { year, month: monthNumber } = monthParts(month)
    const params = new URLSearchParams({
      year: String(year),
      month: String(monthNumber),
    })
    if (selectedListId) params.set('listId', String(selectedListId))

    try {
      const data = await api<MonthlyBillBoardResponse>(`/api/monthly-bills?${params}`)
      setBoard(data)
      if (!selectedListId && data.activeList) {
        setSelectedListId(data.activeList.id)
      }
    } catch {
      pushToast(t('tools.monthlyBills.errors.load'), 'error')
    } finally {
      setLoading(false)
    }
  }, [month, selectedListId, t, user])

  useEffect(() => { loadBoard() }, [loadBoard])

  useEffect(() => {
    if (!user) return
    api<FamilyTodoSpace[]>('/api/family-todo/spaces')
      .then(setSpaces)
      .catch(() => setSpaces([]))
  }, [user])

  useEffect(() => {
    if (!activeList) {
      setListDraftName('')
      setListDraftSpaceId('')
      return
    }
    setListDraftName(activeList.name)
    setListDraftSpaceId(spaceSelectValue(activeList.sharedSpaceId))
  }, [activeList?.id, activeList?.name, activeList?.sharedSpaceId])

  function updateForm<K extends keyof BillForm>(key: K, value: BillForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setEditingItem(null)
    setForm(emptyForm)
  }

  function moveMonth(offset: number) {
    setMonth((current) => getRelativeMonthKey(current, offset))
  }

  function handleMonthChange(value: string) {
    if (isValidMonthKey(value)) setMonth(value)
  }

  async function handleCreateList(event: React.FormEvent) {
    event.preventDefault()
    const name = newListName.trim()
    if (!name) return

    setSaving(true)
    try {
      const list = await api<MonthlyBillListResponse>('/api/monthly-bills/lists', {
        method: 'POST',
        body: {
          name,
          sharedSpaceId: newListSpaceId ? Number(newListSpaceId) : null,
        },
      })
      setNewListName('')
      setNewListSpaceId('')
      setSelectedListId(list.id)
    } catch {
      pushToast(t('tools.monthlyBills.errors.saveList'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveListSettings(event: React.FormEvent) {
    event.preventDefault()
    if (!activeList) return

    const name = listDraftName.trim()
    if (!name) {
      pushToast(t('tools.monthlyBills.errors.listNameRequired'), 'error')
      return
    }

    setSaving(true)
    try {
      await api(`/api/monthly-bills/lists/${activeList.id}`, {
        method: 'PATCH',
        body: {
          name,
          sharedSpaceId: listDraftSpaceId ? Number(listDraftSpaceId) : null,
        },
      })
      await loadBoard()
    } catch {
      pushToast(t('tools.monthlyBills.errors.saveList'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteList() {
    if (!activeList || !confirm(t('tools.monthlyBills.confirmDeleteList', { name: activeList.name }))) return

    setSaving(true)
    try {
      await api(`/api/monthly-bills/lists/${activeList.id}`, { method: 'DELETE' })
      setSelectedListId(null)
      resetForm()
    } catch {
      pushToast(t('tools.monthlyBills.errors.deleteList'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleEditItem(item: MonthlyBillItemResponse) {
    setEditingItem(item)
    setForm({
      name: item.name,
      dueDay: String(item.dueDay),
      amount: centsToInput(item.amountCents),
      note: item.note ?? '',
    })
  }

  async function handleSubmitItem(event: React.FormEvent) {
    event.preventDefault()
    if (!activeList) return

    const name = form.name.trim()
    const dueDay = Number(form.dueDay)
    const amount = form.amount.trim()
    const amountCents = amount ? parseAmountToCents(amount) : null
    const note = form.note.trim()

    if (!name) {
      pushToast(t('tools.monthlyBills.errors.nameRequired'), 'error')
      return
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      pushToast(t('tools.monthlyBills.errors.dueDay'), 'error')
      return
    }
    if (amount && amountCents === null) {
      pushToast(t('tools.monthlyBills.errors.amount'), 'error')
      return
    }

    setSaving(true)
    try {
      if (editingItem) {
        await api(`/api/monthly-bills/items/${editingItem.id}`, {
          method: 'PATCH',
          body: { name, dueDay, amountCents, note: note || null },
        })
      } else {
        await api(`/api/monthly-bills/lists/${activeList.id}/items`, {
          method: 'POST',
          body: { name, dueDay, amountCents, note: note || null },
        })
      }
      resetForm()
      await loadBoard()
    } catch {
      pushToast(t('tools.monthlyBills.errors.saveItem'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteItem(item: MonthlyBillItemResponse) {
    if (!confirm(t('tools.monthlyBills.confirmDelete', { name: item.name }))) return

    setSaving(true)
    try {
      await api(`/api/monthly-bills/items/${item.id}`, { method: 'DELETE' })
      if (editingItem?.id === item.id) resetForm()
      await loadBoard()
    } catch {
      pushToast(t('tools.monthlyBills.errors.deleteItem'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleItem(item: MonthlyBillItemResponse) {
    const snapshot = board
    const nextChecked = !item.checkedAt
    const { year, month: monthNumber } = monthParts(month)

    if (snapshot) {
      setBoard({
        ...snapshot,
        items: snapshot.items.map((current) =>
          current.id === item.id
            ? {
                ...current,
                checkedAt: nextChecked ? new Date().toISOString() : null,
                checkedBy: nextChecked && user
                  ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, email: user.email }
                  : null,
                status: nextChecked ? 'paid' : item.status === 'paid' ? 'upcoming' : item.status,
              }
            : current,
        ),
      })
    }

    try {
      await api(`/api/monthly-bills/items/${item.id}/check`, {
        method: 'PATCH',
        body: { year, month: monthNumber, checked: nextChecked },
      })
      await loadBoard()
    } catch {
      if (snapshot) setBoard(snapshot)
      pushToast(t('tools.monthlyBills.errors.toggleItem'), 'error')
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Link href="/tools" className="mochi-spring mb-6 inline-block text-sm text-muted hover:text-text">
          {t('tools.backToTools')}
        </Link>
        <div className="mochi-card p-8 text-center">
          <ReceiptText size={44} className="mx-auto mb-4 text-accent" />
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-text">
            {t('tools.monthlyBills.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted">
            {t('tools.monthlyBills.loginRequired')}
          </p>
          <Link
            href="/login"
            className="mochi-spring mt-6 inline-flex items-center justify-center rounded-2xl bg-cta px-5 py-3 text-sm font-bold text-white hover:bg-cta-hover"
          >
            {t('common.login')}
          </Link>
        </div>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40'
  const labelClass = 'mb-1 block text-sm font-medium text-text'

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Link href="/tools" className="mochi-spring mb-6 inline-block text-sm text-muted hover:text-text">
        {t('tools.backToTools')}
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ReceiptText size={24} strokeWidth={2.4} />
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-text">
            {t('tools.monthlyBills.title')}
          </h1>
          <p className="mt-2 text-muted">{t('tools.monthlyBills.description')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            title={t('tools.monthlyBills.previousMonth')}
            className="mochi-spring rounded-full border border-border p-3 text-muted hover:border-accent hover:text-accent"
          >
            <ChevronLeft size={18} />
          </button>
          <label className="min-w-0">
            <span className="sr-only">{t('tools.monthlyBills.month')}</span>
            <input
              type="month"
              value={month}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            title={t('tools.monthlyBills.nextMonth')}
            className="mochi-spring rounded-full border border-border p-3 text-muted hover:border-accent hover:text-accent"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label={t('tools.monthlyBills.summary.month')} value={formatMonthLabel(month, i18n.language)} />
        <SummaryTile label={t('tools.monthlyBills.summary.paid')} value={`${summary.paidCount}/${summary.totalCount}`} />
        <SummaryTile label={t('tools.monthlyBills.summary.unpaidAmount')} value={formatHKD(summary.unpaidAmountCents)} />
        <SummaryTile label={t('tools.monthlyBills.summary.overdue')} value={String(summary.overdueCount + summary.dueTodayCount)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="mochi-card p-5">
            <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-text">
              {t('tools.monthlyBills.lists')}
            </h2>
            <div className="space-y-2">
              {(board?.lists ?? []).map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className={`mochi-spring w-full rounded-2xl border px-3 py-3 text-left ${
                    activeList?.id === list.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface text-text hover:border-border-strong'
                  }`}
                >
                  <span className="block truncate text-sm font-bold">{list.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {list.sharedSpaceName
                      ? t('tools.monthlyBills.sharedWith', { name: list.sharedSpaceName })
                      : t('tools.monthlyBills.privateList')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateList} className="mochi-card p-5">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-sm font-bold text-text">
              {t('tools.monthlyBills.createList')}
            </h3>
            <div className="space-y-3">
              <input
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                className={inputClass}
                placeholder={t('tools.monthlyBills.placeholders.listName')}
              />
              <select
                value={newListSpaceId}
                onChange={(event) => setNewListSpaceId(event.target.value)}
                className={inputClass}
              >
                <option value="">{t('tools.monthlyBills.privateList')}</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {t('tools.monthlyBills.shareTo', { name: space.name })}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={saving || !newListName.trim()}
                className="mochi-spring flex w-full items-center justify-center gap-2 rounded-2xl bg-cta px-4 py-3 text-sm font-bold text-white hover:bg-cta-hover disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t('common.create')}
              </button>
            </div>
          </form>
        </aside>

        <main className="min-w-0 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : !activeList ? (
            <div className="mochi-card flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <CalendarCheck size={44} className="mb-4 text-muted/40" />
              <p className="text-muted">{t('tools.monthlyBills.emptyLists')}</p>
            </div>
          ) : (
            <>
              <section className="mochi-card p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text">
                    {activeList.name}
                  </h2>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                    {activeList.sharedSpaceName
                      ? t('tools.monthlyBills.sharedWith', { name: activeList.sharedSpaceName })
                      : t('tools.monthlyBills.privateList')}
                  </span>
                  {activeList.access !== 'owner' && (
                    <span className="rounded-full bg-muted/10 px-3 py-1 text-xs font-bold text-muted">
                      {t(`tools.monthlyBills.access.${activeList.access}`)}
                    </span>
                  )}
                </div>

                {canManageList ? (
                  <form onSubmit={handleSaveListSettings} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      value={listDraftName}
                      onChange={(event) => setListDraftName(event.target.value)}
                      className={inputClass}
                      aria-label={t('tools.monthlyBills.fields.listName')}
                    />
                    <select
                      value={listDraftSpaceId}
                      onChange={(event) => setListDraftSpaceId(event.target.value)}
                      className={inputClass}
                      aria-label={t('tools.monthlyBills.fields.share')}
                    >
                      <option value="">{t('tools.monthlyBills.privateList')}</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {t('tools.monthlyBills.shareTo', { name: space.name })}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={saving}
                      className="mochi-spring flex items-center justify-center gap-2 rounded-2xl bg-cta px-4 py-3 text-sm font-bold text-white hover:bg-cta-hover disabled:opacity-50"
                    >
                      <Share2 size={16} />
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteList}
                      disabled={saving}
                      className="mochi-spring flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-muted hover:border-red-500 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      {t('common.delete')}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-muted">{t('tools.monthlyBills.sharedMemberHint')}</p>
                )}
              </section>

              {canManageItems && (
                <form onSubmit={handleSubmitItem} className="mochi-card p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text">
                      {editingItem ? t('tools.monthlyBills.editBill') : t('tools.monthlyBills.addBill')}
                    </h2>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={resetForm}
                        title={t('common.cancel')}
                        className="mochi-spring rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_120px_160px]">
                    <div>
                      <label className={labelClass}>{t('tools.monthlyBills.fields.name')}</label>
                      <input
                        value={form.name}
                        onChange={(event) => updateForm('name', event.target.value)}
                        className={inputClass}
                        placeholder={t('tools.monthlyBills.placeholders.name')}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('tools.monthlyBills.fields.dueDay')}</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={form.dueDay}
                        onChange={(event) => updateForm('dueDay', event.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('tools.monthlyBills.fields.amount')}</label>
                      <input
                        inputMode="decimal"
                        value={form.amount}
                        onChange={(event) => updateForm('amount', event.target.value)}
                        className={inputClass}
                        placeholder="1280.50"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={labelClass}>{t('tools.monthlyBills.fields.note')}</label>
                    <textarea
                      value={form.note}
                      onChange={(event) => updateForm('note', event.target.value)}
                      className={`${inputClass} min-h-20 resize-none`}
                      placeholder={t('tools.monthlyBills.placeholders.note')}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="mochi-spring mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-cta px-5 py-3 text-sm font-bold text-white hover:bg-cta-hover disabled:opacity-50 md:w-auto"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : editingItem ? <Pencil size={16} /> : <Plus size={16} />}
                    {editingItem ? t('common.update') : t('common.create')}
                  </button>
                </form>
              )}

              {items.length === 0 ? (
                <div className="mochi-card flex min-h-72 flex-col items-center justify-center p-8 text-center">
                  <CalendarCheck size={44} className="mb-4 text-muted/40" />
                  <p className="text-muted">{t('tools.monthlyBills.empty')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((entry) => (
                    <BillRow
                      key={entry.id}
                      entry={entry}
                      language={i18n.language}
                      canManageItems={canManageItems}
                      onToggle={() => handleToggleItem(entry)}
                      onEdit={() => handleEditItem(entry)}
                      onDelete={() => handleDeleteItem(entry)}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface px-5 py-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-text">{value || '-'}</p>
    </div>
  )
}

function BillRow({
  entry,
  language,
  canManageItems,
  onToggle,
  onEdit,
  onDelete,
  t,
}: {
  entry: MonthlyBillItemResponse
  language: string
  canManageItems: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-4">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onToggle}
          aria-label={entry.checkedAt ? t('tools.monthlyBills.markUnpaid') : t('tools.monthlyBills.markPaid')}
          className={`mochi-spring mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
            entry.checkedAt
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border text-muted hover:border-accent hover:text-accent'
          }`}
        >
          {entry.checkedAt && <Check size={18} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
              {formatDueDateLabel(entry.dueDate, language)}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[entry.status]}`}>
              {t(`tools.monthlyBills.status.${entry.status}`)}
            </span>
            {entry.checkedBy && (
              <span className="rounded-full bg-muted/10 px-3 py-1 text-xs font-bold text-muted">
                {t('tools.monthlyBills.checkedBy', {
                  name: entry.checkedBy.displayName || entry.checkedBy.email || `User ${entry.checkedBy.id}`,
                })}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`truncate text-base font-bold ${entry.checkedAt ? 'text-muted line-through' : 'text-text'}`}>
                {entry.name}
              </h3>
              {entry.note && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">{entry.note}</p>
              )}
            </div>
            {entry.amountCents !== null && (
              <p className="shrink-0 text-sm font-bold text-text">{formatHKD(entry.amountCents)}</p>
            )}
          </div>
        </div>

        {canManageItems && (
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={onEdit}
              title={t('common.edit')}
              className="mochi-spring rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title={t('common.delete')}
              className="mochi-spring rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
