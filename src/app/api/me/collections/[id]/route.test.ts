import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/collection-service', () => ({
  getById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/server/services/link-service', () => ({
  listForCollection: vi.fn().mockResolvedValue([]),
}))

describe('/api/me/collections/[id]', () => {
  let GET: any, PATCH: any, DELETE: any
  let collectionService: any
  let permissionService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    collectionService = await import('@/server/services/collection-service')
    permissionService = await import('@/server/services/permission-service')
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
    it('returns collection by id', async () => {
      collectionService.getById.mockResolvedValue({
        id: 1, title: 'Test', description: null, icon: null,
        visibility: 'private', sortOrder: 0,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const res = await GET(makeReq('/api/me/collections/1'), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(1)
    })

    it('returns 404 for missing collection', async () => {
      collectionService.getById.mockResolvedValue(null)
      const res = await GET(makeReq('/api/me/collections/999'), { user })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH', () => {
    it('updates collection', async () => {
      collectionService.update.mockResolvedValue({
        id: 1, title: 'Updated', description: 'desc', icon: null,
        visibility: 'private', sortOrder: 0,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const req = makeReq('/api/me/collections/1', { title: 'Updated' })
      const res = await PATCH(req, { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.title).toBe('Updated')
    })

    it('returns 404 when update finds nothing', async () => {
      collectionService.update.mockResolvedValue(null)
      const req = makeReq('/api/me/collections/999', { title: 'X' })
      const res = await PATCH(req, { user })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('deletes collection and returns 204', async () => {
      const res = await DELETE(makeReq('/api/me/collections/1'), { user })
      expect(res.status).toBe(204)
      expect(collectionService.remove).toHaveBeenCalledWith(1)
    })
  })
})
