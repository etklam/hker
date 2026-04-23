import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 })
const mockGetClientIp = vi.fn().mockReturnValue('127.0.0.1')

vi.mock('@/server/api-helpers', () => ({
  withOptionalAuth: (handler: any) => handler,
  rateLimit: mockRateLimit,
  getClientIp: mockGetClientIp,
}))

vi.mock('@/server/services/family-todo-space-service', () => ({
  getInviteByToken: vi.fn(),
}))

describe('GET /api/family-todo/invites/[token]', () => {
  let GET: any
  let spaceService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    mockGetClientIp.mockReturnValue('127.0.0.1')
    const mod = await import('./route')
    GET = mod.GET
    spaceService = await import('@/server/services/family-todo-space-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('returns invite details', async () => {
    spaceService.getInviteByToken.mockResolvedValue({
      spaceId: 1, spaceName: 'Family', spaceOwnerId: 1,
      maxUses: null, useCount: 0, expiresAt: null,
    })
    const res = await GET(makeReq('/api/family-todo/invites/abc123'), { user: null })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.space.name).toBe('Family')
    expect(body.isValid).toBe(true)
  })

  it('returns 404 for missing invite', async () => {
    spaceService.getInviteByToken.mockResolvedValue(null)
    const res = await GET(makeReq('/api/family-todo/invites/nonexistent'), { user: null })
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30000 })
    const res = await GET(makeReq('/api/family-todo/invites/abc'), { user: null })
    expect(res.status).toBe(429)
  })

  it('marks expired invite as invalid', async () => {
    spaceService.getInviteByToken.mockResolvedValue({
      spaceId: 1, spaceName: 'Family', spaceOwnerId: 1,
      maxUses: null, useCount: 0, expiresAt: new Date('2020-01-01'),
    })
    const res = await GET(makeReq('/api/family-todo/invites/expired'), { user: null })
    const body = await res.json()
    expect(body.isValid).toBe(false)
  })
})
