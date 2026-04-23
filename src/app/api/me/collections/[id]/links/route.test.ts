import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/link-service', () => ({
  listForCollection: vi.fn(),
  create: vi.fn(),
}))

describe('/api/me/collections/[id]/links', () => {
  let GET: any, POST: any
  let linkService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    POST = mod.POST
    linkService = await import('@/server/services/link-service')
  })

  function makeReq(url: string, body?: any) {
    const req = new Request(`http://localhost:3000${url}`, body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  describe('GET', () => {
    it('returns links for collection', async () => {
      linkService.listForCollection.mockResolvedValue([{ id: 1, title: 'Link1' }])
      const res = await GET(makeReq('/api/me/collections/1/links'), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(1)
    })
  })

  describe('POST', () => {
    it('returns 400 for missing title', async () => {
      const res = await POST(makeReq('/api/me/collections/1/links', { url: 'https://example.com' }), { user })
      expect(res.status).toBe(400)
    })

    it('returns 400 for missing url', async () => {
      const res = await POST(makeReq('/api/me/collections/1/links', { title: 'Test' }), { user })
      expect(res.status).toBe(400)
    })

    it('creates link and returns 201', async () => {
      linkService.create.mockResolvedValue({ id: 1, title: 'Link', url: 'https://example.com' })
      const res = await POST(makeReq('/api/me/collections/1/links', { title: 'Link', url: 'https://example.com' }), { user })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.title).toBe('Link')
    })

    it('handles AppError', async () => {
      linkService.create.mockRejectedValue(new AppError('INVALID_REQUEST', 'Invalid URL'))
      const res = await POST(makeReq('/api/me/collections/1/links', { title: 'Link', url: 'bad' }), { user })
      expect(res.status).toBe(400)
    })
  })
})
