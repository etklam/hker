import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/server/services/auth-service', () => ({
  register: vi.fn(),
}))

vi.mock('@/server/services/session-service', () => ({
  createSession: vi.fn().mockResolvedValue('mock-token'),
}))

vi.mock('@/server/auth', () => ({
  setSessionCookie: vi.fn().mockReturnValue('session-cookie-value'),
}))

describe('POST /api/auth/register', () => {
  let POST: any
  let authService: any
  let apiHelpers: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    authService = await import('@/server/services/auth-service')
    apiHelpers = await import('@/server/api-helpers')
  })

  function makeReq(body: any) {
    return new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
  }

  it('returns 400 for missing email', async () => {
    const res = await POST(makeReq({ password: 'password123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeReq({ email: 'not-an-email', password: 'password123' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('email')
  })

  it('returns 400 for short password', async () => {
    const res = await POST(makeReq({ email: 'test@test.com', password: 'short' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('Password')
  })

  it('returns 201 on successful registration', async () => {
    authService.register.mockResolvedValue({
      id: 1, email: 'new@test.com', displayName: 'NewUser', avatarUrl: null, role: 'user',
    })
    const res = await POST(makeReq({ email: 'new@test.com', password: 'password123', displayName: 'NewUser' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.authenticated).toBe(true)
    expect(body.user.displayName).toBe('NewUser')
  })

  it('returns 409 for duplicate email', async () => {
    authService.register.mockRejectedValue(new Error('unique constraint violation'))
    const res = await POST(makeReq({ email: 'existing@test.com', password: 'password123' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('CONFLICT')
  })

  it('handles AppError from service', async () => {
    authService.register.mockRejectedValue(new AppError('INVALID_REQUEST', 'Bad'))
    const res = await POST(makeReq({ email: 'test@test.com', password: 'password123' }))
    expect(res.status).toBe(400)
  })

  it('returns rate limited response', async () => {
    apiHelpers.applyRateLimit.mockResolvedValue(new Response(JSON.stringify({ code: 'RATE_LIMITED' }), { status: 429 }))
    const res = await POST(makeReq({ email: 'test@test.com', password: 'password123' }))
    expect(res.status).toBe(429)
  })
})
