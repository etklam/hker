import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/subscription-service', () => ({
  listUserSubscriptions: vi.fn(),
}))

describe('GET /api/me/subscriptions', () => {
  let GET: any
  let subscriptionService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    subscriptionService = await import('@/server/services/subscription-service')
  })

  it('returns user subscriptions', async () => {
    subscriptionService.listUserSubscriptions.mockResolvedValue([{ id: 1, collectionId: 10 }])
    const res = await GET(new Request('http://localhost:3000/api/me/subscriptions') as any, { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
