import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/collection-service', () => ({
  listForUser: vi.fn(),
  create: vi.fn(),
}))

describe('/api/me/collections', () => {
  let GET: any, POST: any
  let collectionService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    POST = mod.POST
    collectionService = await import('@/server/services/collection-service')
  })

  describe('GET', () => {
    it('returns collections for user', async () => {
      collectionService.listForUser.mockResolvedValue([{ id: 1, title: 'My Collection' }])
      const res = await GET(new Request('http://localhost:3000/api/me/collections') as any, { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(1)
    })
  })

  describe('POST', () => {
    function makeReq(body: any) {
      return new Request('http://localhost:3000/api/me/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }) as any
    }

    it('returns 400 for missing title', async () => {
      const res = await POST(makeReq({}), { user })
      expect(res.status).toBe(400)
    })

    it('returns 400 for empty title', async () => {
      const res = await POST(makeReq({ title: '   ' }), { user })
      expect(res.status).toBe(400)
    })

    it('creates collection and returns 201', async () => {
      collectionService.create.mockResolvedValue({
        id: 1, title: 'New', description: null, icon: null,
        visibility: 'private', sortOrder: 0,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const res = await POST(makeReq({ title: 'New' }), { user })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.title).toBe('New')
      expect(body.access).toBe('owner')
    })

    it('handles AppError from service', async () => {
      collectionService.create.mockRejectedValue(new AppError('NOT_FOUND', 'Not found'))
      const res = await POST(makeReq({ title: 'Test' }), { user })
      expect(res.status).toBe(404)
    })
  })
})
