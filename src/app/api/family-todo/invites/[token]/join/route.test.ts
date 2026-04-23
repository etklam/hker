import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

const mockRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 })
const mockGetClientIp = vi.fn().mockReturnValue('127.0.0.1')

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
  rateLimit: mockRateLimit,
  getClientIp: mockGetClientIp,
}))

vi.mock('@/server/services/family-todo-space-service', () => ({
  joinSpace: vi.fn(),
}))

describe('POST /api/family-todo/invites/[token]/join', () => {
  let POST: any
  let spaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    mockGetClientIp.mockReturnValue('127.0.0.1')
    const mod = await import('./route')
    POST = mod.POST
    spaceService = await import('@/server/services/family-todo-space-service')
  })

  function makeReq(token: string) {
    const url = `http://localhost:3000/api/family-todo/invites/${token}/join`
    const req = new Request(url, { method: 'POST' }) as any
    req.nextUrl = new URL(url)
    return req
  }

  it('joins space via invite', async () => {
    spaceService.joinSpace.mockResolvedValue({
      space: { id: 1, name: 'Family', ownerId: 2 },
      role: 'member',
    })
    const res = await POST(makeReq('abc123'), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('member')
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30000 })
    const res = await POST(makeReq('abc123'), { user })
    expect(res.status).toBe(429)
  })

  it('handles AppError from service', async () => {
    spaceService.joinSpace.mockRejectedValue(new AppError('NOT_FOUND', 'Invite not found'))
    const res = await POST(makeReq('bad'), { user })
    expect(res.status).toBe(404)
  })
})
