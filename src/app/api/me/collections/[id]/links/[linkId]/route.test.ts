import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/link-service', () => ({
  update: vi.fn(),
  remove: vi.fn(),
}))

describe('/api/me/collections/[id]/links/[linkId]', () => {
  let PATCH: any, DELETE: any
  let linkService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    linkService = await import('@/server/services/link-service')
  })

  function makeReq(url: string, body?: any) {
    const req = new Request(`http://localhost:3000${url}`, body ? {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  describe('PATCH', () => {
    it('updates link', async () => {
      linkService.update.mockResolvedValue({ id: 1, title: 'Updated' })
      const res = await PATCH(makeReq('/api/me/collections/1/links/5', { title: 'Updated' }), { user })
      expect(res.status).toBe(200)
      expect(linkService.update).toHaveBeenCalledWith(1, 5, expect.objectContaining({ title: 'Updated' }))
    })

    it('returns 404 when link not found', async () => {
      linkService.update.mockResolvedValue(null)
      const res = await PATCH(makeReq('/api/me/collections/1/links/999', { title: 'X' }), { user })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('deletes link and returns 204', async () => {
      const res = await DELETE(makeReq('/api/me/collections/1/links/5'), { user })
      expect(res.status).toBe(204)
      expect(linkService.remove).toHaveBeenCalledWith(1, 5)
    })
  })
})
