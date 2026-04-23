import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withOptionalAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/invite-service', () => ({
  getByToken: vi.fn(),
}))

describe('GET /api/invites/[token]', () => {
  let GET: any
  let inviteService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    inviteService = await import('@/server/services/invite-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('returns invite details', async () => {
    inviteService.getByToken.mockResolvedValue({
      collectionId: 1, collectionTitle: 'Test', collectionDescription: 'Desc', collectionIcon: null,
      role: 'viewer', maxUses: null, useCount: 0, expiresAt: null,
    })
    const res = await GET(makeReq('/api/invites/abc123'), { user: null })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collection.title).toBe('Test')
    expect(body.isValid).toBe(true)
  })

  it('returns 404 for missing invite', async () => {
    inviteService.getByToken.mockResolvedValue(null)
    const res = await GET(makeReq('/api/invites/nonexistent'), { user: null })
    expect(res.status).toBe(404)
  })

  it('marks expired invite as invalid', async () => {
    inviteService.getByToken.mockResolvedValue({
      collectionId: 1, collectionTitle: 'Test', collectionDescription: 'Desc', collectionIcon: null,
      role: 'viewer', maxUses: null, useCount: 0, expiresAt: new Date('2020-01-01'),
    })
    const res = await GET(makeReq('/api/invites/expired'), { user: null })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isValid).toBe(false)
  })
})
