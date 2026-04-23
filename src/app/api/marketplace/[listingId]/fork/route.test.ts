import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/subscription-service', () => ({
  fork: vi.fn(),
}))

describe('POST /api/marketplace/[listingId]/fork', () => {
  let POST: any
  let subscriptionService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    subscriptionService = await import('@/server/services/subscription-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`, { method: 'POST' }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('forks a listing', async () => {
    subscriptionService.fork.mockResolvedValue({ collectionId: 99 })
    const res = await POST(makeReq('/api/marketplace/1/fork'), { user })
    expect(res.status).toBe(201)
    expect(subscriptionService.fork).toHaveBeenCalledWith(1, 1)
  })

  it('returns 400 for invalid listing id', async () => {
    const res = await POST(makeReq('/api/marketplace/abc/fork'), { user })
    expect(res.status).toBe(400)
  })
})
