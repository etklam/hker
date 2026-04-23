import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

const mockApplyRateLimit = vi.fn().mockResolvedValue(null)
const mockIsAccountLocked = vi.fn().mockResolvedValue(false)
const mockTrackLoginFailure = vi.fn()
const mockClearLoginFailures = vi.fn()

vi.mock('@/server/api-helpers', () => ({
  applyRateLimit: mockApplyRateLimit,
  isAccountLocked: mockIsAccountLocked,
  trackLoginFailure: mockTrackLoginFailure,
  clearLoginFailures: mockClearLoginFailures,
}))

vi.mock('@/server/services/auth-service', () => ({
  login: vi.fn(),
}))

vi.mock('@/server/services/session-service', () => ({
  createSession: vi.fn().mockResolvedValue('mock-token'),
}))

vi.mock('@/server/auth', () => ({
  setSessionCookie: vi.fn().mockReturnValue('session-cookie-value'),
}))

describe('POST /api/auth/login', () => {
  let POST: any
  let authService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockResolvedValue(null)
    mockIsAccountLocked.mockResolvedValue(false)
    const mod = await import('./route')
    POST = mod.POST
    authService = await import('@/server/services/auth-service')
  })

  function makeReq(body: any) {
    return new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
  }

  it('returns 400 for missing email', async () => {
    const res = await POST(makeReq({ password: 'pass' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_REQUEST')
  })

  it('returns 400 for missing password', async () => {
    const res = await POST(makeReq({ email: 'test@test.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when account is locked', async () => {
    mockIsAccountLocked.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'locked@test.com', password: 'pass' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN')
  })

  it('returns 401 for invalid credentials', async () => {
    authService.login.mockRejectedValue(new AppError('INVALID_CREDENTIALS', 'Bad creds'))
    const res = await POST(makeReq({ email: 'test@test.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('INVALID_CREDENTIALS')
    expect(mockTrackLoginFailure).toHaveBeenCalledWith('test@test.com')
  })

  it('returns session on successful login', async () => {
    authService.login.mockResolvedValue({
      id: 1, email: 'test@test.com', displayName: 'Test', avatarUrl: null, role: 'user',
    })
    const res = await POST(makeReq({ email: 'test@test.com', password: 'password123' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.authenticated).toBe(true)
    expect(body.user.email).toBe('test@test.com')
    expect(mockClearLoginFailures).toHaveBeenCalledWith('test@test.com')
  })

  it('returns rate limited response', async () => {
    mockApplyRateLimit.mockResolvedValue(new Response(JSON.stringify({ code: 'RATE_LIMITED' }), { status: 429 }))
    const res = await POST(makeReq({ email: 'test@test.com', password: 'pass' }))
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
