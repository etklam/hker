import { describe, it, expect, vi, afterEach } from 'vitest'
import { middleware } from '@/middleware'

function createMockRequest(pathname: string) {
  const url = new URL(`http://localhost:3000${pathname}`)
  return {
    nextUrl: url,
    cookies: { get: vi.fn() },
    headers: new Headers(),
  } as any
}

describe('middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sets common security headers', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = createMockRequest('/some-page')
    const response = middleware(req)

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('X-DNS-Prefetch-Control')).toBe('on')
  })

  it('sets HSTS and CSP in production only', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const req = createMockRequest('/')
    const response = middleware(req)

    expect(response.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains',
    )
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
  })

  it('does not set HSTS in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = createMockRequest('/')
    const response = middleware(req)

    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
    expect(response.headers.get('Content-Security-Policy')).toBeNull()
  })

  it('adds Cache-Control no-store for admin routes', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = createMockRequest('/api/admin/users')
    const response = middleware(req)

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('does not add Cache-Control for non-admin routes', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = createMockRequest('/api/me/collections')
    const response = middleware(req)

    expect(response.headers.get('Cache-Control')).toBeNull()
  })
})
