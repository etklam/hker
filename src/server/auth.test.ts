import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDbUser, mockSession } from '@/test/fixtures'

vi.mock('@/server/services/session-service', () => ({
  validateSession: vi.fn(),
}))

describe('auth', () => {
  let auth: typeof import('@/server/auth')
  let sessionService: typeof import('@/server/services/session-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    auth = await import('@/server/auth')
    sessionService = await import('@/server/services/session-service')
  })

  describe('resolveSession', () => {
    it('returns null when no cookie', async () => {
      const req = { cookies: { get: vi.fn().mockReturnValue(undefined) } } as any
      expect(await auth.resolveSession(req)).toBeNull()
    })

    it('returns null when session validation fails', async () => {
      vi.mocked(sessionService.validateSession).mockResolvedValue(null)
      const req = { cookies: { get: vi.fn().mockReturnValue({ value: 'token' }) } } as any
      expect(await auth.resolveSession(req)).toBeNull()
    })

    it('returns AuthUser when session is valid', async () => {
      vi.mocked(sessionService.validateSession).mockResolvedValue({ session: mockSession, user: mockDbUser } as any)
      const req = { cookies: { get: vi.fn().mockReturnValue({ value: 'token' }) } } as any
      const result = await auth.resolveSession(req)

      expect(result).toEqual({
        id: mockDbUser.id,
        email: mockDbUser.email,
        displayName: mockDbUser.displayName,
        avatarUrl: mockDbUser.avatarUrl,
        role: mockDbUser.role,
      })
    })
  })

  describe('setSessionCookie', () => {
    it('includes HttpOnly, SameSite=Lax, Path=/', () => {
      vi.stubEnv('APP_BASE_URL', '')
      vi.stubEnv('NODE_ENV', 'development')

      const cookie = auth.setSessionCookie('token123', new Date('2025-12-31'))
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).toContain('Path=/')
      expect(cookie).toContain('token123')
    })

    it('includes Secure when https', () => {
      vi.stubEnv('APP_BASE_URL', 'https://example.com')
      expect(auth.setSessionCookie('t', new Date())).toContain('Secure')
    })

    it('omits Secure when not https', () => {
      vi.stubEnv('APP_BASE_URL', 'http://localhost:3000')
      expect(auth.setSessionCookie('t', new Date())).not.toContain('Secure')
    })
  })

  describe('clearSessionCookie', () => {
    it('sets Max-Age=0 and epoch Expires', () => {
      vi.stubEnv('APP_BASE_URL', '')
      vi.stubEnv('NODE_ENV', 'development')

      const cookie = auth.clearSessionCookie()
      expect(cookie).toContain('Max-Age=0')
      expect(cookie).toContain('Thu, 01 Jan 1970 00:00:00 GMT')
      expect(cookie).toContain('HttpOnly')
    })
  })
})
