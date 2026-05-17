import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-service', () => ({
  update: vi.fn(),
  remove: vi.fn(),
}))

describe('/api/spaces/[sid]', () => {
  let PATCH: any, DELETE: any
  let spaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    spaceService = await import('@/server/services/space-service')
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
    it('updates space', async () => {
      spaceService.update.mockResolvedValue({
        id: 1, name: 'Updated', ownerId: 1,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const res = await PATCH(makeReq('/api/spaces/1', { name: 'Updated' }), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe('Updated')
    })

    it('returns 404 when space not found', async () => {
      spaceService.update.mockResolvedValue(null)
      const res = await PATCH(makeReq('/api/spaces/999', { name: 'X' }), { user })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('deletes space and returns 204', async () => {
      const res = await DELETE(makeReq('/api/spaces/1'), { user })
      expect(res.status).toBe(204)
      expect(spaceService.remove).toHaveBeenCalledWith(1)
    })
  })
})
