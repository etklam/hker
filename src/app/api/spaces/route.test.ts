import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/space-service', () => ({
  listForUser: vi.fn(),
  create: vi.fn(),
}))

describe('/api/spaces', () => {
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

  describe('GET', () => {
    it('returns spaces for user', async () => {
      spaceService.listForUser.mockResolvedValue([{ id: 1, name: 'Space' }])
      const res = await GET(new Request('http://localhost:3000/api/spaces') as any, { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(1)
    })
  })

  describe('POST', () => {
    function makeReq(body: any) {
      return new Request('http://localhost:3000/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }) as any
    }

    it('returns 400 for missing name', async () => {
      const res = await POST(makeReq({}), { user })
      expect(res.status).toBe(400)
    })

    it('returns 400 for empty name', async () => {
      const res = await POST(makeReq({ name: '   ' }), { user })
      expect(res.status).toBe(400)
    })

    it('creates space and returns 201', async () => {
      spaceService.create.mockResolvedValue({
        id: 1, name: 'Space', ownerId: 1,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const res = await POST(makeReq({ name: 'Space' }), { user })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.name).toBe('Space')
    })

    it('handles AppError from service', async () => {
      spaceService.create.mockRejectedValue(new AppError('CONFLICT', 'Duplicate'))
      const res = await POST(makeReq({ name: 'Test' }), { user })
      expect(res.status).toBe(409)
    })
  })
})
