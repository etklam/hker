import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

describe('member-service', () => {
  let ms: typeof import('@/server/services/member-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    ms = await import('@/server/services/member-service')
  })

  describe('listForCollection', () => {
    it('returns members with joinedAt as ISO string', async () => {
      const joinedAt = new Date('2025-01-01')
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 1, userId: 2, role: 'editor', joinedAt, displayName: 'Bob', avatarUrl: null, email: 'bob@test.com' },
            ]),
          }),
        }),
      } as any)

      const members = await ms.listForCollection(1)
      expect(members).toHaveLength(1)
      expect(members[0].joinedAt).toBe(joinedAt.toISOString())
      expect(members[0].role).toBe('editor')
    })
  })

  describe('updateRole', () => {
    it('returns updated member when found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, role: 'viewer' }]),
          }),
        }),
      } as any)

      const result = await ms.updateRole(1, 1, 'viewer')
      expect(result).toEqual({ id: 1, role: 'viewer' })
    })

    it('returns null when member not found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await ms.updateRole(1, 999, 'viewer')
      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('returns deleted member when found', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any)

      const result = await ms.remove(1, 1)
      expect(result).toEqual({ id: 1 })
    })

    it('returns null when not found', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await ms.remove(1, 999)
      expect(result).toBeNull()
    })
  })
})
