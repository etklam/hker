import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { AppError } from '@/lib/errors'

describe('invite-service', () => {
  let is: typeof import('@/server/services/invite-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    is = await import('@/server/services/invite-service')
  })

  const mockInvite = {
    id: 1, collectionId: 1, token: 'test-token', role: 'editor' as const,
    maxUses: null, useCount: 0, expiresAt: null, createdBy: 1, createdAt: new Date('2025-01-01'),
  }
  const mockCollection = {
    id: 1, ownerId: 1, title: 'Test', description: null, icon: null,
    visibility: 'private' as const, sortOrder: 0, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
  }

  describe('create', () => {
    it('creates invite with retry on unique violation', async () => {
      let callCount = 0
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            callCount++
            if (callCount === 1) {
              const err = new Error('unique violation')
              ;(err as any).code = '23505'
              throw err
            }
            return Promise.resolve([mockInvite])
          }),
        }),
      } as any)

      const result = await is.create(1, 1, { role: 'editor' })
      expect(result).toEqual(mockInvite)
      expect(callCount).toBe(2)
    })

    it('creates with expiry when expiresInHours provided', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInvite]),
        }),
      } as any)

      const result = await is.create(1, 1, { role: 'editor', expiresInHours: 24 })
      expect(result).toBeDefined()
    })
  })

  describe('isInviteValid', () => {
    it('returns true for valid invite', () => {
      expect(is.isInviteValid({ expiresAt: null, maxUses: null, useCount: 0 })).toBe(true)
    })
    it('returns false for expired invite', () => {
      expect(is.isInviteValid({ expiresAt: new Date('2020-01-01'), maxUses: null, useCount: 0 })).toBe(false)
    })
    it('returns false when maxUses reached', () => {
      expect(is.isInviteValid({ expiresAt: null, maxUses: 5, useCount: 5 })).toBe(false)
    })
    it('returns true when under maxUses', () => {
      expect(is.isInviteValid({ expiresAt: null, maxUses: 5, useCount: 4 })).toBe(true)
    })
  })

  describe('joinCollection', () => {
    it('returns alreadyMember=true for owner', async () => {
      const tx = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([mockInvite]) }) }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockCollection]) }) }),
          }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      const result = await is.joinCollection('test-token', 1)
      expect(result.alreadyMember).toBe(true)
      expect(result.role).toBe('owner')
    })

    it('throws NOT_FOUND for invalid token', async () => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([]) }) }),
        }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      await expect(is.joinCollection('invalid', 1)).rejects.toThrow('Invite not found')
    })
  })

  describe('listForCollection', () => {
    it('returns invites', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInvite]),
        }),
      } as any)

      const result = await is.listForCollection(1)
      expect(result).toHaveLength(1)
    })
  })

  describe('getByToken', () => {
    it('returns invite with collection data', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                ...mockInvite, collectionTitle: 'Test', collectionDescription: null,
                collectionIcon: null, collectionVisibility: 'private', collectionOwnerId: 1,
              }]),
            }),
          }),
        }),
      } as any)

      const result = await is.getByToken('test-token')
      expect(result).toBeDefined()
      expect(result!.collectionTitle).toBe('Test')
    })

    it('returns null when not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)

      const result = await is.getByToken('nonexistent')
      expect(result).toBeNull()
    })
  })
})
