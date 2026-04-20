'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api-client'
import { Shield } from 'lucide-react'

interface UserRow {
  id: number
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}

interface UsersResponse {
  users: UserRow[]
  total: number
  page: number
  totalPages: number
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    api<UsersResponse>(`/api/admin/users?page=${page}&limit=20`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">{t('admin.users')}</h2>
        {data && (
          <span className="text-sm text-muted">
            {t('admin.totalUsers', { count: data.total })}
          </span>
        )}
      </div>

      <div className="mochi-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-muted font-medium">ID</th>
              <th className="px-4 py-3 text-muted font-medium">{t('auth.email')}</th>
              <th className="px-4 py-3 text-muted font-medium">{t('auth.displayName')}</th>
              <th className="px-4 py-3 text-muted font-medium">{t('admin.role')}</th>
              <th className="px-4 py-3 text-muted font-medium">{t('admin.joined')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 text-text">{u.id}</td>
                <td className="px-4 py-3 text-text">{u.email ?? '-'}</td>
                <td className="px-4 py-3 text-text">{u.displayName ?? '-'}</td>
                <td className="px-4 py-3">
                  {u.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                      <Shield size={12} />
                      Admin
                    </span>
                  ) : (
                    <span className="text-muted text-xs">User</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted text-xs">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="mochi-spring rounded-xl border border-border px-4 py-2 text-sm text-muted hover:text-text disabled:opacity-40"
          >
            {t('common.previous')}
          </button>
          <span className="text-sm text-muted">
            {t('common.page', { current: data.page, total: data.totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="mochi-spring rounded-xl border border-border px-4 py-2 text-sm text-muted hover:text-text disabled:opacity-40"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  )
}
