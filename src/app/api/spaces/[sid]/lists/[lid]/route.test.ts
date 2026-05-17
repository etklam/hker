import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-todo-service', () => ({
  updateList: vi.fn(),
  removeList: vi.fn(),
}))

describe('/api/spaces/[sid]/lists/[lid]', () => {
  let PATCH: any, DELETE: any
  let todoService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    todoService = await import('@/server/services/space-todo-service')
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
    it('updates list', async () => {
      todoService.updateList.mockResolvedValue({
        id: 1, spaceId: 1, title: 'Updated', sortOrder: 0, createdAt: new Date(),
      })
      const res = await PATCH(makeReq('/api/spaces/1/lists/5', { title: 'Updated' }), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.title).toBe('Updated')
    })

    it('returns 404 when list not found', async () => {
      todoService.updateList.mockResolvedValue(null)
      const res = await PATCH(makeReq('/api/spaces/1/lists/999', { title: 'X' }), { user })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('deletes list and returns 204', async () => {
      const res = await DELETE(makeReq('/api/spaces/1/lists/5'), { user })
      expect(res.status).toBe(204)
      expect(todoService.removeList).toHaveBeenCalledWith(1, 5)
    })
  })
})
