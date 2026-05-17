import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-service', () => ({
  listInvites: vi.fn(),
  createInvite: vi.fn(),
}))

describe('/api/spaces/[sid]/invites', () => {
  let GET: any, POST: any
  let spaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    POST = mod.POST
    spaceService = await import('@/server/services/space-service')
  })

  function makeReq(url: string, body?: any) {
    const req = new Request(`http://localhost:3000${url}`, body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  describe('GET', () => {
    it('returns invites with urls', async () => {
      spaceService.listInvites.mockResolvedValue([{
        id: 1, token: 'abc', maxUses: null, useCount: 0,
        expiresAt: null, createdAt: new Date('2025-01-01'),
      }])
      const res = await GET(makeReq('/api/spaces/1/invites'), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body[0].url).toContain('/spaces/invite/abc')
    })
  })

  describe('POST', () => {
    it('returns 400 for invalid maxUses', async () => {
      const res = await POST(makeReq('/api/spaces/1/invites', { maxUses: -1 }), { user })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid expiresInHours', async () => {
      const res = await POST(makeReq('/api/spaces/1/invites', { expiresInHours: 0 }), { user })
      expect(res.status).toBe(400)
    })

    it('creates invite and returns 201', async () => {
      spaceService.createInvite.mockResolvedValue({
        id: 1, token: 'xyz', maxUses: 5, useCount: 0,
        expiresAt: new Date('2025-12-31'), createdAt: new Date('2025-01-01'),
      })
      const res = await POST(makeReq('/api/spaces/1/invites', { maxUses: 5 }), { user })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.token).toBe('xyz')
    })
  })
})
