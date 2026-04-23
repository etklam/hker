import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { AppError } from '@/lib/errors'

describe('permission-service', () => {
  let ps: typeof import('@/server/services/permission-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    ps = await import('@/server/services/permission-service')
  })

  // Helper: mock db.select() to return chainable that resolves to given results in sequence
  function mockSelectSequence(results: any[][]) {
    let idx = 0
    vi.mocked(db.select).mockImplementation(() => {
      const result = results[idx++] ?? []
      const limitFn = () => Promise.resolve(result)
      const whereFn = () => ({ limit: limitFn })
      const fromFn = () => ({ where: whereFn, innerJoin: () => ({ where: whereFn }) })
      return { from: fromFn } as any
    })
  }

  describe('getCollectionAccess', () => {
    it('returns "owner" when user is the owner', async () => {
      mockSelectSequence([[{ id: 1, ownerId: 1, visibility: 'private' }]])
      expect(await ps.getCollectionAccess(1, 1)).toBe('owner')
    })

    it('returns "edit" for editor member', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2, visibility: 'private' }],
        [{ role: 'editor' }],
      ])
      expect(await ps.getCollectionAccess(1, 1)).toBe('edit')
    })

    it('returns "view" for viewer member', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2, visibility: 'private' }],
        [{ role: 'viewer' }],
      ])
      expect(await ps.getCollectionAccess(1, 1)).toBe('view')
    })

    it('returns "view" for public collection without membership', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2, visibility: 'public' }],
        [],
      ])
      expect(await ps.getCollectionAccess(1, 1)).toBe('view')
    })

    it('returns "none" when collection not found', async () => {
      mockSelectSequence([[]])
      expect(await ps.getCollectionAccess(1, 1)).toBe('none')
    })

    it('returns "none" for private collection with null userId', async () => {
      mockSelectSequence([[{ id: 1, ownerId: 2, visibility: 'private' }]])
      expect(await ps.getCollectionAccess(null, 1)).toBe('none')
    })

    it('returns "view" for unlisted without membership', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2, visibility: 'unlisted' }],
        [],
      ])
      expect(await ps.getCollectionAccess(1, 1)).toBe('view')
    })
  })

  describe('getSpaceAccess', () => {
    it('returns "owner" when user owns space', async () => {
      mockSelectSequence([[{ id: 1, ownerId: 1 }]])
      expect(await ps.getSpaceAccess(1, 1)).toBe('owner')
    })

    it('returns "none" when no space', async () => {
      mockSelectSequence([[]])
      expect(await ps.getSpaceAccess(999, 1)).toBe('none')
    })

    it('returns "admin" for admin member', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2 }],
        [{ role: 'admin' }],
      ])
      expect(await ps.getSpaceAccess(1, 1)).toBe('admin')
    })

    it('returns "member" for regular member', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2 }],
        [{ role: 'member' }],
      ])
      expect(await ps.getSpaceAccess(1, 1)).toBe('member')
    })

    it('returns "none" when no membership', async () => {
      mockSelectSequence([
        [{ id: 1, ownerId: 2 }],
        [],
      ])
      expect(await ps.getSpaceAccess(1, 1)).toBe('none')
    })
  })

  describe('requireAtLeast', () => {
    it('passes when sufficient', () => {
      expect(() => ps.requireAtLeast('owner', 'edit')).not.toThrow()
      expect(() => ps.requireAtLeast('edit', 'edit')).not.toThrow()
    })
    it('throws when insufficient', () => {
      expect(() => ps.requireAtLeast('view', 'edit')).toThrow(AppError)
    })
  })

  describe('requireSpaceAtLeast', () => {
    it('passes when sufficient', () => {
      expect(() => ps.requireSpaceAtLeast('owner', 'admin')).not.toThrow()
    })
    it('throws when insufficient', () => {
      expect(() => ps.requireSpaceAtLeast('member', 'admin')).toThrow(AppError)
    })
  })
})
