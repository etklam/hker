import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withOptionalAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/marketplace-service', () => ({
  listListings: vi.fn(),
}))

describe('GET /api/marketplace', () => {
  let GET: any
  let marketplaceService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    marketplaceService = await import('@/server/services/marketplace-service')
  })

  it('returns listings with default pagination', async () => {
    marketplaceService.listListings.mockResolvedValue({ items: [], total: 0, page: 0 })
    const url = 'http://localhost:3000/api/marketplace'
    const req = new Request(url) as any
    req.nextUrl = new URL(url)
    const res = await GET(req, { user: null })
    expect(res.status).toBe(200)
    expect(marketplaceService.listListings).toHaveBeenCalledWith(0, 20, 'newest')
  })

  it('passes sort parameter', async () => {
    marketplaceService.listListings.mockResolvedValue({ items: [], total: 0, page: 0 })
    const url = 'http://localhost:3000/api/marketplace?sort=most_subscribed'
    const req = new Request(url) as any
    req.nextUrl = new URL(url)
    const res = await GET(req, { user: null })
    expect(res.status).toBe(200)
    expect(marketplaceService.listListings).toHaveBeenCalledWith(0, 20, 'most_subscribed')
  })
})
