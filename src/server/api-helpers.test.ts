import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'

// Mock auth dependency
vi.mock('@/server/auth', () => ({
  resolveSession: vi.fn(),
}))

describe('api-helpers', () => {
  afterEach(() => vi.unstubAllEnvs())
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
    it('ignores all spoofable headers by default', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '')
      expect(ah.getClientIp({headers:new Headers({'x-real-ip':'192.168.1.1','x-forwarded-for':'203.0.113.9'})})).toBe('untrusted-shared')
    })
    it('uses only a valid overwritten ingress header when explicitly trusted', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
      expect(ah.getClientIp({headers:new Headers({'x-real-ip':'2001:db8::1','x-forwarded-for':'203.0.113.9'})})).toBe('2001:db8::1')
      expect(ah.getClientIp({headers:new Headers({'x-real-ip':'not-an-ip'})})).toBe('untrusted-shared')
      expect(ah.getClientIp({headers:new Headers()})).toBe('untrusted-shared')
    })
  })
  describe('server retirement and exact origin', () => {
    it('blocks retired APIs before authorization, queries or mutation', async () => {
      const handler=vi.fn(async()=>Response.json({ok:true}))
      const request=new NextRequest('https://directory.test/api/me/collections',{method:'POST'})
      expect((await ah.withAuth(handler)(request)).status).toBe(410)
      expect((await ah.withOptionalAuth(handler)(request)).status).toBe(410)
      expect(handler).not.toHaveBeenCalled()
      expect(auth.resolveSession).not.toHaveBeenCalled()
      expect(db.select).not.toHaveBeenCalled()
    })
    it('compares scheme, host and port and refuses malformed origins', () => {
      vi.stubEnv('APP_BASE_URL','https://directory.test')
      const check=(origin:string)=>ah.validateOrigin(new NextRequest('https://directory.test/api/admin/catalog',{method:'POST',headers:{origin}}))
      expect(check('https://directory.test')).toBe(true)
      for (const value of ['http://directory.test','https://directory.test:8443','https://directory.test.evil','null','https://user@directory.test','https://directory.test/path']) expect(check(value)).toBe(false)
      expect(ah.validateOrigin(new NextRequest('https://directory.test/api/admin/catalog',{method:'POST',headers:{referer:'https://directory.test/admin'}}))).toBe(true)
      expect(ah.validateOrigin(new NextRequest('https://directory.test/api/admin/catalog',{method:'POST',headers:{referer:'http://directory.test/admin'}}))).toBe(false)
    })
    it('fails closed for missing or malformed production configuration', () => {
      vi.stubEnv('NODE_ENV','production')
      const request=new NextRequest('https://directory.test/api/admin/catalog',{method:'POST'})
      vi.stubEnv('APP_BASE_URL','')
      expect(ah.validateOrigin(request)).toBe(false)
      vi.stubEnv('APP_BASE_URL','not-a-url')
      expect(ah.validateOrigin(request)).toBe(false)
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
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve({})),
      } as any)
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
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve({})),
      } as any)
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
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve({})),
      } as any)
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
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve({})),
      } as any)
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
