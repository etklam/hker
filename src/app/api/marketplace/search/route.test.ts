import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withOptionalAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/marketplace-service', () => ({
  searchListings: vi.fn(),
}))

describe('GET /api/marketplace/search', () => {
  let GET: any
  let marketplaceService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    marketplaceService = await import('@/server/services/marketplace-service')
  })

  it('returns 400 when query is missing', async () => {
    const url = 'http://localhost:3000/api/marketplace/search'
    const req = new Request(url) as any
    req.nextUrl = new URL(url)
    const res = await GET(req, { user: null })
    expect(res.status).toBe(400)
  })

  it('returns 400 when query too long', async () => {
    const url = `http://localhost:3000/api/marketplace/search?q=${'a'.repeat(201)}`
    const req = new Request(url) as any
    req.nextUrl = new URL(url)
    const res = await GET(req, { user: null })
    expect(res.status).toBe(400)
  })

  it('searches listings', async () => {
    marketplaceService.searchListings.mockResolvedValue({ items: [{ id: 1 }], total: 1, page: 0 })
    const url = 'http://localhost:3000/api/marketplace/search?q=test'
    const req = new Request(url) as any
    req.nextUrl = new URL(url)
    const res = await GET(req, { user: null })
    expect(res.status).toBe(200)
    expect(marketplaceService.searchListings).toHaveBeenCalledWith('test', 0, 20)
  })
})
