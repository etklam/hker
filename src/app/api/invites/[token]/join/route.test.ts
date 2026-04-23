import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

const mockRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 })
const mockGetClientIp = vi.fn().mockReturnValue('127.0.0.1')

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
  rateLimit: mockRateLimit,
  getClientIp: mockGetClientIp,
}))

vi.mock('@/server/services/invite-service', () => ({
  joinCollection: vi.fn(),
}))

describe('POST /api/invites/[token]/join', () => {
  let POST: any
  let inviteService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    mockGetClientIp.mockReturnValue('127.0.0.1')
    const mod = await import('./route')
    POST = mod.POST
    inviteService = await import('@/server/services/invite-service')
  })

  function makeReq(token: string) {
    const url = `http://localhost:3000/api/invites/${token}/join`
    const req = new Request(url, { method: 'POST' }) as any
    req.nextUrl = new URL(url)
    return req
  }

  it('joins collection via invite', async () => {
    inviteService.joinCollection.mockResolvedValue({
      collection: { id: 1, title: 'Test', description: null, icon: null, visibility: 'public' },
      role: 'viewer',
    })
    const res = await POST(makeReq('abc123'), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('viewer')
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30000 })
    const res = await POST(makeReq('abc123'), { user })
    expect(res.status).toBe(429)
  })

  it('handles AppError from service', async () => {
    inviteService.joinCollection.mockRejectedValue(new AppError('NOT_FOUND', 'Invite not found'))
    const res = await POST(makeReq('bad'), { user })
    expect(res.status).toBe(404)
  })
})
