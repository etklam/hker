import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { AppError } from '@/lib/errors'

describe('subscription-service', () => {
  let ss: typeof import('@/server/services/subscription-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    ss = await import('@/server/services/subscription-service')
  })

  describe('subscribe', () => {
    it('throws NOT_FOUND for missing listing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      await expect(ss.subscribe(1, 999)).rejects.toThrow('Listing not found')
    })

    it('throws when subscribing to own listing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, publisherId: 1 }]),
          }),
        }),
      } as any)

      await expect(ss.subscribe(1, 1)).rejects.toThrow('Cannot subscribe to your own listing')
    })

    it('is idempotent when already subscribed', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, publisherId: 2 }]),
          }),
        }),
      } as any)
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      await ss.subscribe(1, 1)
      // No insert since already exists
      expect(tx.select).toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('does nothing when not subscribed', async () => {
      const tx = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      await expect(ss.unsubscribe(1, 1)).resolves.toBeUndefined()
    })
  })

  describe('isSubscribed', () => {
    it('returns true when subscribed', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as any)

      expect(await ss.isSubscribed(1, 1)).toBe(true)
    })

    it('returns false when not subscribed', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      expect(await ss.isSubscribed(1, 999)).toBe(false)
    })
  })

  describe('fork', () => {
    it('throws NOT_FOUND for missing listing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      await expect(ss.fork(1, 999)).rejects.toThrow('Listing not found')
    })

    it('throws when forking own listing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1, publisherId: 1 }]),
          }),
        }),
      } as any)

      await expect(ss.fork(1, 1)).rejects.toThrow('Cannot fork your own listing')
    })

    it('throws CONFLICT on duplicate fork', async () => {
      let call = 0
      vi.mocked(db.select).mockImplementation(() => {
        call++
        if (call === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1, publisherId: 2 }]) }) }) } as any
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 1 }]) }) }) } as any
      })

      await expect(ss.fork(1, 1)).rejects.toThrow('already forked')
    })

    it('creates fork in transaction', async () => {
      let call = 0
      vi.mocked(db.select).mockImplementation(() => {
        call++
        if (call === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1, publisherId: 2 }]) }) }) } as any
        if (call === 2) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) } as any // no existing fork
        if (call === 3) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 1, ownerId: 2, title: 'Source', description: null, icon: null, visibility: 'public', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }]) }) }) } as any
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as any // source links
      })

      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 2, ownerId: 1, title: 'Source' }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      const result = await ss.fork(1, 1)
      expect(result.collectionId).toBe(2)
    })
  })
})
