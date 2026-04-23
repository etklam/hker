import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { mockDbUser, mockSession } from '@/test/fixtures'

vi.mock('@/server/services/user-service', () => ({
  findById: vi.fn(),
}))

describe('session-service', () => {
  let sessionService: typeof import('@/server/services/session-service')
  let userService: typeof import('@/server/services/user-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_SESSION_SECRET', 'test-secret-key-for-testing-min-32-chars')
    sessionService = await import('@/server/services/session-service')
    userService = await import('@/server/services/user-service')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('hashSessionToken', () => {
    it('produces deterministic HMAC hash', () => {
      const hash1 = sessionService.hashSessionToken('token123')
      const hash2 = sessionService.hashSessionToken('token123')
      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('string')
      expect(hash1.length).toBeGreaterThan(0)
    })

    it('produces different hashes for different tokens', () => {
      const hash1 = sessionService.hashSessionToken('token1')
      const hash2 = sessionService.hashSessionToken('token2')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('createSession', () => {
    it('creates session and returns raw token', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any)

      const token = await sessionService.createSession(1)
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('validateSession', () => {
    it('returns null when session not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await sessionService.validateSession('nonexistent')
      expect(result).toBeNull()
    })

    it('returns null and deletes expired session', async () => {
      const expiredSession = { ...mockSession, expiresAt: new Date('2020-01-01') }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([expiredSession]),
          }),
        }),
      } as any)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expiredSession]),
        }),
      } as any)

      const result = await sessionService.validateSession('expired-token')
      expect(result).toBeNull()
    })
  })

  describe('destroySession', () => {
    it('deletes session by token hash', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any)

      await sessionService.destroySession('some-token')
      expect(db.delete).toHaveBeenCalled()
    })
  })
})
