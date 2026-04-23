import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { mockDbUser } from '@/test/fixtures'

describe('user-service', () => {
  // Re-import service to get fresh module with mocked db
  let userService: typeof import('@/server/services/user-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    userService = await import('@/server/services/user-service')
  })

  describe('createUser', () => {
    it('inserts user with normalized email', async () => {
      const mockUser = { ...mockDbUser, email: 'test@example.com' }
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      } as any)

      const user = await userService.createUser('Test@Example.COM', 'John')
      expect(user.email).toBe('test@example.com')
    })
  })

  describe('findByEmail', () => {
    it('returns user when found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDbUser]),
          }),
        }),
      } as any)

      const user = await userService.findByEmail('test@example.com')
      expect(user).toEqual(mockDbUser)
    })

    it('returns null when not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const user = await userService.findByEmail('nobody@example.com')
      expect(user).toBeNull()
    })
  })

  describe('findById', () => {
    it('returns user when found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDbUser]),
          }),
        }),
      } as any)

      const user = await userService.findById(1)
      expect(user).toEqual(mockDbUser)
    })

    it('returns null when not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const user = await userService.findById(999)
      expect(user).toBeNull()
    })
  })

  describe('fetchUsersById', () => {
    it('returns Map of users', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockDbUser]),
        }),
      } as any)

      const map = await userService.fetchUsersById([1])
      expect(map).toBeInstanceOf(Map)
      expect(map.get(1)).toEqual(mockDbUser)
    })

    it('returns empty Map for empty array without DB call', async () => {
      const map = await userService.fetchUsersById([])
      expect(map).toBeInstanceOf(Map)
      expect(map.size).toBe(0)
      expect(db.select).not.toHaveBeenCalled()
    })
  })
})
