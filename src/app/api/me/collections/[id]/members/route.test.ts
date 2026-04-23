import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/member-service', () => ({
  listForCollection: vi.fn(),
}))

describe('GET /api/me/collections/[id]/members', () => {
  let GET: any
  let memberService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    memberService = await import('@/server/services/member-service')
  })

  it('returns members for collection', async () => {
    memberService.listForCollection.mockResolvedValue([{ id: 1, role: 'editor' }])
    const req = new Request('http://localhost:3000/api/me/collections/1/members') as any
    req.nextUrl = new URL('http://localhost:3000/api/me/collections/1/members')
    const res = await GET(req, { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
