import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

describe('collection-service', () => {
  let cs: typeof import('@/server/services/collection-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    cs = await import('@/server/services/collection-service')
  })

  describe('getById', () => {
    it('returns collection when found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, title: 'Test' }]),
          }),
        }),
      } as any)

      const result = await cs.getById(1)
      expect(result).toEqual({ id: 1, title: 'Test' })
    })

    it('returns null when not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await cs.getById(999)
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('creates a private collection', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, ownerId: 1, title: 'New', visibility: 'private', sortOrder: 0 }]),
        }),
      } as any)

      const result = await cs.create(1, { title: 'New' })
      expect(result.title).toBe('New')
    })
  })

  describe('update', () => {
    it('returns updated collection', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Updated' }]),
          }),
        }),
      } as any)

      const result = await cs.update(1, { title: 'Updated' })
      expect(result).toEqual({ id: 1, title: 'Updated' })
    })

    it('returns null when not found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await cs.update(999, { title: 'X' })
      expect(result).toBeNull()
    })
  })

  describe('updateVisibility', () => {
    it('returns updated collection', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, visibility: 'public' }]),
          }),
        }),
      } as any)

      const result = await cs.updateVisibility(1, 'public')
      expect(result!.visibility).toBe('public')
    })
  })

  describe('remove', () => {
    it('deletes without error', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any)

      await expect(cs.remove(1)).resolves.toBeUndefined()
    })
  })

  describe('listForUser', () => {
    it('returns owned and member collections', async () => {
      const now = new Date('2025-06-01T00:00:00Z')
      const ownedRow = { id: 1, ownerId: 1, title: 'Owned', description: null, icon: null, visibility: 'private', sortOrder: 0, createdAt: now, updatedAt: new Date('2025-06-02'), memberRole: null }
      const memberRow = { id: 2, ownerId: 2, title: 'Shared', description: null, icon: null, visibility: 'private', sortOrder: 0, createdAt: now, updatedAt: new Date('2025-06-03'), memberRole: 'editor' }

      let selectCall = 0
      vi.mocked(db.select).mockImplementation(() => {
        selectCall++
        if (selectCall === 1) {
          // owned query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([ownedRow]),
            }),
          } as any
        }
        if (selectCall === 2) {
          // member query
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([memberRow]),
              }),
            }),
          } as any
        }
        // link counts query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { collectionId: 1, count: 5 },
                { collectionId: 2, count: 3 },
              ]),
            }),
          }),
        } as any
      })

      const result = await cs.listForUser(1)
      expect(result).toHaveLength(2)
      // Sorted by updatedAt desc
      expect(result[0].title).toBe('Shared')
      expect(result[1].title).toBe('Owned')
      expect(result[0].access).toBe('editor')
      expect(result[1].access).toBe('owner')
    })
  })
})
