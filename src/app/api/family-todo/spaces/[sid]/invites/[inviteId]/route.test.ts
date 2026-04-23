import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/family-todo-space-service', () => ({
  deleteInvite: vi.fn(),
}))

describe('DELETE /api/family-todo/spaces/[sid]/invites/[inviteId]', () => {
  let DELETE: any
  let spaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    DELETE = mod.DELETE
    spaceService = await import('@/server/services/family-todo-space-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`, { method: 'DELETE' }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('deletes invite and returns 204', async () => {
    const res = await DELETE(makeReq('/api/family-todo/spaces/1/invites/5'), { user })
    expect(res.status).toBe(204)
    expect(spaceService.deleteInvite).toHaveBeenCalledWith(1, 5)
  })
})
