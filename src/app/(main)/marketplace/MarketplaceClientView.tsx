'use client'

import React, { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { SearchBar } from '@/components/SearchBar'
import { MarketplaceCard } from '@/components/MarketplaceCard'
import { api } from '@/lib/api-client'
import type { MarketplaceListing, PageResponse } from '@/lib/types'

interface Props {
  initialData: PageResponse<MarketplaceListing>
  initialQuery: string
  initialSort: string
}

export function MarketplaceClientView({ initialData, initialQuery, initialSort }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [data, setData] = useState(initialData)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState(initialSort)
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (q: string, s: string, page: number) => {
    setLoading(true)
    try {
      if (q) {
        const result = await api<PageResponse<MarketplaceListing>>(
          `/api/marketplace/search?q=${encodeURIComponent(q)}&page=${page}&size=20`,
        )
        setData(result)
      } else {
        const result = await api<PageResponse<MarketplaceListing>>(
          `/api/marketplace?page=${page}&size=20&sort=${s}`,
        )
        setData(result)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSearch() {
    const params = new URLSearchParams(searchParams.toString())
    if (query) params.set('q', query)
    else params.delete('q')
    params.delete('page')
    router.push(`/marketplace?${params.toString()}`)
    doSearch(query, sort, 0)
  }

  function handleSortChange(newSort: string) {
    setSort(newSort)
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', newSort)
    params.delete('page')
    router.push(`/marketplace?${params.toString()}`)
    doSearch(query, newSort, 0)
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`/marketplace?${params.toString()}`)
    doSearch(query, sort, page)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      {/* Hero */}
      <section className="relative mb-12 text-center">
        <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-12 left-1/3 -z-10 h-40 w-40 rounded-full bg-cta/10 blur-2xl" />
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-accent sm:text-5xl">
          {t('marketplace.title')}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          {t('marketplace.description')}
        </p>
      </section>

      {/* Search + Sort */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBar
            value={query}
            placeholder={t('marketplace.search')}
            onChange={setQuery}
            onSearch={handleSearch}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-muted" />
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text outline-none mochi-spring focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            <option value="newest">Newest</option>
            <option value="most_subscribed">Most Subscribed</option>
          </select>
        </div>
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : data.content.length === 0 ? (
        <p className="py-20 text-center text-muted">{t('marketplace.empty')}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.content.map((listing) => (
            <MarketplaceCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToPage(i)}
              className={`mochi-spring rounded-full px-4 py-2 text-sm font-medium ${
                i === data.page
                  ? 'bg-accent text-white'
                  : 'border border-border bg-surface text-muted hover:bg-accent-soft hover:text-accent'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
