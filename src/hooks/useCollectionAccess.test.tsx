import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCollectionAccess } from '@/hooks/useCollectionAccess'
import type { Collection } from '@/lib/types'

function makeCollection(access: Collection['access']): Collection {
  return {
    id: 1,
    title: 'Test',
    description: null,
    icon: null,
    visibility: 'private',
    sortOrder: 0,
    linkCount: 0,
    access,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }
}

describe('useCollectionAccess', () => {
  it('owner can edit and manage', () => {
    const { result } = renderHook(() => useCollectionAccess(makeCollection('owner')))
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canManage).toBe(true)
  })

  it('editor can edit but not manage', () => {
    const { result } = renderHook(() => useCollectionAccess(makeCollection('editor')))
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canManage).toBe(false)
  })

  it('viewer can neither edit nor manage', () => {
    const { result } = renderHook(() => useCollectionAccess(makeCollection('viewer')))
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('none access can neither edit nor manage', () => {
    const { result } = renderHook(() => useCollectionAccess(makeCollection('none')))
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('null collection returns both false', () => {
    const { result } = renderHook(() => useCollectionAccess(null))
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('memoizes result for same collection reference', () => {
    const collection = makeCollection('owner')
    const { result, rerender } = renderHook(
      ({ c }) => useCollectionAccess(c),
      { initialProps: { c: collection } },
    )
    const first = result.current
    rerender({ c: collection })
    expect(result.current).toBe(first)
  })
})
