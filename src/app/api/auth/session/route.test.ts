import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withOptionalAuth: (handler: any) => handler,
}))

const mockUser = {
  id: 1,
  email: 'test@test.com',
  displayName: 'Test',
  avatarUrl: null,
  role: 'user' as const,
}

describe('GET /api/auth/session', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
  })

  it('returns authenticated user', async () => {
    const req = new Request('http://localhost:3000/api/auth/session') as any
    const res = await GET(req, { user: mockUser })
    const body = await res.json()

    expect(body.authenticated).toBe(true)
    expect(body.user.email).toBe('test@test.com')
  })

  it('returns unauthenticated when no user', async () => {
    const req = new Request('http://localhost:3000/api/auth/session') as any
    const res = await GET(req, { user: null })
    const body = await res.json()

    expect(body.authenticated).toBe(false)
    expect(body.user).toBeNull()
  })
})
