import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withOptionalAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/marketplace-service', () => ({
  getDetail: vi.fn(),
}))

describe('GET /api/marketplace/[listingId]', () => {
  let GET: any
  let marketplaceService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    marketplaceService = await import('@/server/services/marketplace-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('returns listing detail', async () => {
    marketplaceService.getDetail.mockResolvedValue({ id: 1, collection: { title: 'Test' } })
    const res = await GET(makeReq('/api/marketplace/1'), { user: null })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(1)
  })

  it('returns 400 for invalid listing id', async () => {
    const res = await GET(makeReq('/api/marketplace/abc'), { user: null })
    expect(res.status).toBe(400)
  })
})
