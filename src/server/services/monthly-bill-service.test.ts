import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/services/permission-service', async () => {
  const actual = await vi.importActual<typeof import('@/server/services/permission-service')>(
    '@/server/services/permission-service',
  )
  return {
    ...actual,
    getSpaceAccess: vi.fn(),
  }
})

vi.mock('@/server/services/user-service', () => ({
  fetchUsersById: vi.fn().mockResolvedValue(new Map()),
}))

import { db } from '@/server/db'
import { getSpaceAccess } from '@/server/services/permission-service'

describe('monthly-bill-service', () => {
  let service: typeof import('@/server/services/monthly-bill-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    service = await import('@/server/services/monthly-bill-service')
  })

  describe('createList - share target validation', () => {
    it('rejects when user has no access to share target space', async () => {
      vi.mocked(getSpaceAccess).mockResolvedValue('none')

      await expect(
        service.createList(7, { name: 'Bills', sharedSpaceId: 99 }),
      ).rejects.toThrowError(AppError)
    })

    it('creates list when user is a member of share target', async () => {
      vi.mocked(getSpaceAccess).mockResolvedValue('member')
      const now = new Date('2026-06-15')
      const createdRow = { id: 1, ownerId: 7, name: 'Bills', sharedSpaceId: 99, createdAt: now, updatedAt: now }

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdRow]),
        }),
      } as any)

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                list: createdRow,
                sharedSpaceName: 'Family',
              }]),
            }),
          }),
        }),
      } as any)

      const result = await service.createList(7, { name: 'Bills', sharedSpaceId: 99 })
      expect(result.name).toBe('Bills')
      expect(result.sharedSpaceId).toBe(99)
      expect(result.access).toBe('owner')
    })
  })

  describe('updateList - access control', () => {
    const listRow = {
      id: 5, ownerId: 7, name: 'Bills', sharedSpaceId: 99,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }

    function mockListAccess(access: 'admin' | 'member' | 'none') {
      vi.mocked(getSpaceAccess).mockResolvedValue(access)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                list: listRow,
                sharedSpaceName: 'Family',
              }]),
            }),
          }),
        }),
      } as any)
    }

    it('throws FORBIDDEN when caller is space admin but not list owner', async () => {
      mockListAccess('admin')

      await expect(
        service.updateList(8, 5, { name: 'Renamed' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('throws FORBIDDEN when caller is space member', async () => {
      mockListAccess('member')

      await expect(
        service.updateList(8, 5, { name: 'Renamed' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('throws NOT_FOUND when list missing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)

      await expect(
        service.updateList(8, 999, { name: 'Renamed' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('removeList - access control', () => {
    const listRow = {
      id: 5, ownerId: 7, name: 'Bills', sharedSpaceId: 99,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }

    it('throws FORBIDDEN when caller is space admin', async () => {
      vi.mocked(getSpaceAccess).mockResolvedValue('admin')
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ list: listRow, sharedSpaceName: 'Family' }]),
            }),
          }),
        }),
      } as any)

      await expect(service.removeList(8, 5)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('createItem - dueDay validation', () => {
    const listRow = {
      id: 5, ownerId: 7, name: 'Bills', sharedSpaceId: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }

    function mockOwnerAccess() {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ list: listRow, sharedSpaceName: null }]),
            }),
          }),
        }),
      } as any)
    }

    it.each([
      ['zero', 0],
      ['over 31', 32],
      ['negative', -1],
      ['decimal', 5.5],
    ])('rejects dueDay %s', async (_label, dueDay) => {
      mockOwnerAccess()

      await expect(
        service.createItem(7, 5, { name: 'Rent', dueDay, amountCents: null, note: null }),
      ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    })

    it('throws FORBIDDEN when caller is space member (not admin/owner)', async () => {
      const sharedListRow = { ...listRow, sharedSpaceId: 99 }
      vi.mocked(getSpaceAccess).mockResolvedValue('member')
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ list: sharedListRow, sharedSpaceName: 'Family' }]),
            }),
          }),
        }),
      } as any)

      await expect(
        service.createItem(8, 5, { name: 'Rent', dueDay: 5, amountCents: null, note: null }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('setItemChecked - access control', () => {
    const itemRow = {
      id: 12, listId: 5, name: 'Rent', dueDay: 5, amountCents: 128000, note: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }
    const listRow = {
      id: 5, ownerId: 7, name: 'Bills', sharedSpaceId: 99,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }

    function mockItemFound(access: 'member' | 'admin' | 'owner' | 'none') {
      vi.mocked(getSpaceAccess).mockResolvedValue(access)
      let call = 0
      vi.mocked(db.select).mockImplementation(() => {
        call++
        if (call === 1) {
          // getItemAccess: select items + lists
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ item: itemRow, listId: 5 }]),
                }),
              }),
            }),
          } as any
        }
        // getListAccess: select lists + spaces
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ list: listRow, sharedSpaceName: 'Family' }]),
              }),
            }),
          }),
        } as any
      })
    }

    it('allows member with view access to check item', async () => {
      mockItemFound('member')
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      await expect(
        service.setItemChecked(8, 12, { year: 2026, month: 6 }, true),
      ).resolves.toBeUndefined()
      expect(db.insert).toHaveBeenCalled()
    })

    it('allows member with view access to uncheck item', async () => {
      mockItemFound('member')
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any)

      await expect(
        service.setItemChecked(8, 12, { year: 2026, month: 6 }, false),
      ).resolves.toBeUndefined()
      expect(db.delete).toHaveBeenCalled()
    })

    it('throws FORBIDDEN when user has no access', async () => {
      mockItemFound('none')

      await expect(
        service.setItemChecked(99, 12, { year: 2026, month: 6 }, true),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('throws NOT_FOUND when item missing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)

      await expect(
        service.setItemChecked(8, 9999, { year: 2026, month: 6 }, true),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('getBoard - empty state', () => {
    it('returns empty items when user has no accessible lists', async () => {
      let call = 0
      vi.mocked(db.select).mockImplementation(() => {
        call++
        if (call === 1) {
          // owned lists: from().leftJoin().where()
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any
        }
        // shared lists: from().innerJoin().innerJoin().where()
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any
      })

      const result = await service.getBoard(7, { year: 2026, month: 6 })
      expect(result.lists).toEqual([])
      expect(result.items).toEqual([])
      expect(result.activeList).toBeNull()
    })
  })
})
