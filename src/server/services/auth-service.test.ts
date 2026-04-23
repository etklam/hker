import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { mockDbUser, mockAuthIdentity } from '@/test/fixtures'

vi.mock('@/server/services/user-service', () => ({
  findById: vi.fn(),
}))

describe('auth-service', () => {
  let authService: typeof import('@/server/services/auth-service')
  let userService: typeof import('@/server/services/user-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    authService = await import('@/server/services/auth-service')
    userService = await import('@/server/services/user-service')
  })

  describe('register', () => {
    it('creates user and auth identity in transaction', async () => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockDbUser, id: 1 }]),
          }),
        }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      const user = await authService.register('Test@Example.COM', 'password123', 'John')
      expect(user).toBeDefined()
      expect(tx.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('login', () => {
    it('throws INVALID_CREDENTIALS when no identity found', async () => {
      vi.mocked(db.select).mockImplementation(() => {
        const result: any[] = []
        const limitFn = () => Promise.resolve(result)
        const whereFn = () => ({ limit: limitFn })
        const fromFn = () => ({ where: whereFn })
        return { from: fromFn } as any
      })

      await expect(authService.login('nobody@example.com', 'password'))
        .rejects.toThrow('Invalid email or password')
    })

    it('throws INVALID_CREDENTIALS when identity has no passwordHash', async () => {
      vi.mocked(db.select).mockImplementation(() => {
        const result = [{ ...mockAuthIdentity, passwordHash: null }]
        const limitFn = () => Promise.resolve(result)
        const whereFn = () => ({ limit: limitFn })
        const fromFn = () => ({ where: whereFn })
        return { from: fromFn } as any
      })

      await expect(authService.login('test@example.com', 'password'))
        .rejects.toThrow('Invalid email or password')
    })
  })
})
