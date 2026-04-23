import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

describe('family-todo-space-service', () => {
  let ss: typeof import('@/server/services/family-todo-space-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    ss = await import('@/server/services/family-todo-space-service')
  })

  const mockSpace = { id: 1, name: 'Space', ownerId: 1, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') }

  describe('listForUser', () => {
    it('returns owned and member spaces', async () => {
      let call = 0
      vi.mocked(db.select).mockImplementation(() => {
        call++
        if (call === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ ...mockSpace, role: 'owner' }]) }) } as any
        }
        return { from: vi.fn().mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }) } as any
      })

      const result = await ss.listForUser(1)
      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('owner')
    })
  })

  describe('getById', () => {
    it('returns space', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockSpace]) }),
        }),
      } as any)

      expect(await ss.getById(1)).toEqual(mockSpace)
    })

    it('returns null', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      } as any)

      expect(await ss.getById(999)).toBeNull()
    })
  })

  describe('create', () => {
    it('creates space with owner member', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSpace]),
        }),
      } as any)

      const result = await ss.create(1, 'Space')
      expect(result.name).toBe('Space')
      expect(result.role).toBe('owner')
      expect(db.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('update', () => {
    it('returns updated space', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockSpace, name: 'Updated' }]),
          }),
        }),
      } as any)

      const result = await ss.update(1, { name: 'Updated' })
      expect(result!.name).toBe('Updated')
    })
  })

  describe('remove', () => {
    it('deletes', async () => {
      vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as any)
      await expect(ss.remove(1)).resolves.toBeUndefined()
    })
  })

  describe('listMembers', () => {
    it('returns members', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              id: 1, userId: 1, role: 'owner', joinedAt: new Date('2025-01-01'),
              displayName: 'User', avatarUrl: null, email: 'u@t.com',
            }]),
          }),
        }),
      } as any)

      const result = await ss.listMembers(1)
      expect(result).toHaveLength(1)
    })
  })

  describe('createInvite', () => {
    it('retries on unique violation', async () => {
      let callCount = 0
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            callCount++
            if (callCount === 1) {
              const err = new Error('unique')
              ;(err as any).code = '23505'
              throw err
            }
            return Promise.resolve([{ id: 1, token: 'abc', spaceId: 1 }])
          }),
        }),
      } as any)

      const result = await ss.createInvite(1, 1, {})
      expect(result).toBeDefined()
      expect(callCount).toBe(2)
    })
  })

  describe('isInviteValid', () => {
    it('returns true for valid', () => expect(ss.isInviteValid({ expiresAt: null, maxUses: null, useCount: 0 })).toBe(true))
    it('returns false for expired', () => expect(ss.isInviteValid({ expiresAt: new Date('2020-01-01'), maxUses: null, useCount: 0 })).toBe(false))
    it('returns false for max uses', () => expect(ss.isInviteValid({ expiresAt: null, maxUses: 5, useCount: 5 })).toBe(false))
  })

  describe('joinSpace', () => {
    it('returns alreadyMember for owner', async () => {
      const tx = {
        select: vi.fn()
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([{ id: 1, spaceId: 1, token: 't', maxUses: null, useCount: 0, expiresAt: null, createdBy: 1, createdAt: new Date() }]) }) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockSpace]) }) }) }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      const result = await ss.joinSpace('t', 1)
      expect(result.alreadyMember).toBe(true)
      expect(result.role).toBe('owner')
    })

    it('throws for invalid token', async () => {
      const tx = { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([]) }) }) }) }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      await expect(ss.joinSpace('invalid', 1)).rejects.toThrow('Invite not found')
    })
  })
})
