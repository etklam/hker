import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/subscription-service', () => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))

describe('/api/marketplace/[listingId]/subscribe', () => {
  let POST: any, DELETE: any
  let subscriptionService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    DELETE = mod.DELETE
    subscriptionService = await import('@/server/services/subscription-service')
  })

  function makeReq(url: string, method: string = 'POST') {
    const req = new Request(`http://localhost:3000${url}`, { method }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  describe('POST', () => {
    it('subscribes to listing', async () => {
      const res = await POST(makeReq('/api/marketplace/1/subscribe'), { user })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.subscribed).toBe(true)
    })

    it('returns 400 for invalid listing id', async () => {
      const res = await POST(makeReq('/api/marketplace/abc/subscribe'), { user })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE', () => {
    it('unsubscribes from listing', async () => {
      const res = await DELETE(makeReq('/api/marketplace/1/subscribe', 'DELETE'), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.subscribed).toBe(false)
    })
  })
})
