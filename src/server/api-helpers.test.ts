import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

// Mock auth dependency
vi.mock('@/server/auth', () => ({
  resolveSession: vi.fn(),
}))

describe('api-helpers', () => {
  let ah: typeof import('@/server/api-helpers')
  let auth: typeof import('@/server/auth')

  beforeEach(async () => {
    vi.clearAllMocks()
    ah = await import('@/server/api-helpers')
    auth = await import('@/server/auth')
  })

  describe('getRateLimitConfig', () => {
    it('returns specific config for known endpoints', () => {
      expect(ah.getRateLimitConfig('POST', '/api/auth/login').limit).toBe(20)
      expect(ah.getRateLimitConfig('POST', '/api/auth/register').limit).toBe(10)
      expect(ah.getRateLimitConfig('GET', '/api/marketplace/search').limit).toBe(60)
      expect(ah.getRateLimitConfig('GET', '/api/marketplace').limit).toBe(90)
    })

    it('returns default for unknown endpoints', () => {
      expect(ah.getRateLimitConfig('GET', '/api/unknown').limit).toBe(120)
    })
  })

  describe('getClientIp', () => {
    it('returns x-real-ip by default', () => {
      vi.stubEnv('TRUSTED_PROXIES', '')
      const req = { headers: new Headers({ 'x-real-ip': '192.168.1.1' }) } as any
      expect(ah.getClientIp(req)).toBe('192.168.1.1')
    })

    it('returns 127.0.0.1 when no headers', () => {
      vi.stubEnv('TRUSTED_PROXIES', '')
      expect(ah.getClientIp({ headers: new Headers() } as any)).toBe('127.0.0.1')
    })

    // Note: TRUSTED_PROXIES is read at module level and cached as a Set.
    // vi.stubEnv won't affect it after import. These tests verify the function
    // logic with the default empty TRUSTED_PROXIES set.

    it('ignores x-forwarded-for when proxy not trusted (default)', () => {
      const req = {
        headers: new Headers({
          'x-real-ip': '10.0.0.1',
          'x-forwarded-for': '203.0.113.50',
        }),
      } as any
      // 10.0.0.1 is NOT in default empty TRUSTED_PROXIES, so direct IP is used
      expect(ah.getClientIp(req)).toBe('10.0.0.1')
    })
  })

  describe('isAccountLocked', () => {
    it('returns false when no entry exists', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      expect(await ah.isAccountLocked('test@example.com')).toBe(false)
    })

    it('returns false when lockedUntil is null', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ lockedUntil: null }]),
          }),
        }),
      } as any)

      expect(await ah.isAccountLocked('test@example.com')).toBe(false)
    })

    it('returns false when lockedUntil is in the past', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ lockedUntil: new Date('2020-01-01') }]),
          }),
        }),
      } as any)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{}]),
        }),
      } as any)

      expect(await ah.isAccountLocked('test@example.com')).toBe(false)
    })

    it('returns true when lockedUntil is in the future', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ lockedUntil: new Date(Date.now() + 60000) }]),
          }),
        }),
      } as any)

      expect(await ah.isAccountLocked('test@example.com')).toBe(true)
    })
  })

  describe('trackLoginFailure', () => {
    it('creates new entry on first failure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any)

      await ah.trackLoginFailure('test@example.com')
      expect(db.insert).toHaveBeenCalled()
    })

    it('increments count on subsequent failures', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ failCount: 3 }]),
          }),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      await ah.trackLoginFailure('test@example.com')
      expect(db.update).toHaveBeenCalled()
    })
  })

  describe('withAuth', () => {
    it('returns 401 when no session', async () => {
      vi.mocked(auth.resolveSession).mockResolvedValue(null)
      // Rate limit allows
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hitCount: 0 }]),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any)
      vi.stubEnv('APP_BASE_URL', '')
      vi.stubEnv('NODE_ENV', 'test')

      const handler = ah.withAuth(async (_req, ctx) => Response.json({ userId: ctx.user.id }))
      const req = {
        url: 'http://localhost:3000/api/test', method: 'GET',
        headers: new Headers(), cookies: { get: vi.fn() },
        nextUrl: new URL('http://localhost:3000/api/test'),
      } as any

      const response = await handler(req)
      expect(response.status).toBe(401)
    })

    it('calls handler when authenticated', async () => {
      vi.mocked(auth.resolveSession).mockResolvedValue({ id: 1, role: 'user' } as any)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hitCount: 0 }]),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any)
      vi.stubEnv('APP_BASE_URL', '')
      vi.stubEnv('NODE_ENV', 'test')

      const handler = ah.withAuth(async (_req, ctx) => Response.json({ userId: ctx.user.id }))
      const req = {
        url: 'http://localhost:3000/api/test', method: 'GET',
        headers: new Headers(), cookies: { get: vi.fn() },
        nextUrl: new URL('http://localhost:3000/api/test'),
      } as any

      const response = await handler(req)
      expect(response.status).toBe(200)
    })
  })

  describe('withAdmin', () => {
    it('returns 403 for non-admin', async () => {
      vi.mocked(auth.resolveSession).mockResolvedValue({ id: 1, role: 'user' } as any)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hitCount: 0 }]),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any)
      vi.stubEnv('APP_BASE_URL', '')
      vi.stubEnv('NODE_ENV', 'test')

      const handler = ah.withAdmin(async () => Response.json({ ok: true }))
      const req = {
        url: 'http://localhost:3000/api/admin', method: 'GET',
        headers: new Headers(), cookies: { get: vi.fn() },
        nextUrl: new URL('http://localhost:3000/api/admin'),
      } as any

      const response = await handler(req)
      expect(response.status).toBe(403)
    })

    it('allows admin users', async () => {
      vi.mocked(auth.resolveSession).mockResolvedValue({ id: 1, role: 'admin' } as any)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hitCount: 0 }]),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any)
      vi.stubEnv('APP_BASE_URL', '')
      vi.stubEnv('NODE_ENV', 'test')

      const handler = ah.withAdmin(async () => Response.json({ ok: true }))
      const req = {
        url: 'http://localhost:3000/api/admin', method: 'GET',
        headers: new Headers(), cookies: { get: vi.fn() },
        nextUrl: new URL('http://localhost:3000/api/admin'),
      } as any

      const response = await handler(req)
      expect(response.status).toBe(200)
    })
  })
})
