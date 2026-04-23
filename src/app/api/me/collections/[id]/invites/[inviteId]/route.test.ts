import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/invite-service', () => ({
  remove: vi.fn(),
}))

describe('DELETE /api/me/collections/[id]/invites/[inviteId]', () => {
  let DELETE: any
  let inviteService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    DELETE = mod.DELETE
    inviteService = await import('@/server/services/invite-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('deletes invite and returns 204', async () => {
    const res = await DELETE(makeReq('/api/me/collections/1/invites/5'), { user })
    expect(res.status).toBe(204)
    expect(inviteService.remove).toHaveBeenCalledWith(1, 5)
  })
})
