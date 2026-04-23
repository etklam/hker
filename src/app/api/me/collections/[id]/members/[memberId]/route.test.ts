import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/member-service', () => ({
  updateRole: vi.fn(),
  remove: vi.fn(),
}))

describe('/api/me/collections/[id]/members/[memberId]', () => {
  let PATCH: any, DELETE: any
  let memberService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    memberService = await import('@/server/services/member-service')
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
    it('updates member role', async () => {
      memberService.updateRole.mockResolvedValue({ id: 2, role: 'editor' })
      const res = await PATCH(makeReq('/api/me/collections/1/members/2', { role: 'editor' }), { user })
      expect(res.status).toBe(200)
      expect(memberService.updateRole).toHaveBeenCalledWith(1, 2, 'editor')
    })

    it('returns 400 for invalid role', async () => {
      const res = await PATCH(makeReq('/api/me/collections/1/members/2', { role: 'admin' }), { user })
      expect(res.status).toBe(400)
    })

    it('returns 404 when member not found', async () => {
      memberService.updateRole.mockResolvedValue(null)
      const res = await PATCH(makeReq('/api/me/collections/1/members/999', { role: 'editor' }), { user })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('removes member and returns 204', async () => {
      const res = await DELETE(makeReq('/api/me/collections/1/members/2'), { user })
      expect(res.status).toBe(204)
      expect(memberService.remove).toHaveBeenCalledWith(1, 2)
    })
  })
})
