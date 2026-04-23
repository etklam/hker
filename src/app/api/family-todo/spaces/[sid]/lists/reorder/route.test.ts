import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/family-todo-service', () => ({
  reorderLists: vi.fn(),
}))

describe('PATCH /api/family-todo/spaces/[sid]/lists/reorder', () => {
  let PATCH: any
  let todoService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    todoService = await import('@/server/services/family-todo-service')
  })

  function makeReq(body: any) {
    const url = 'http://localhost:3000/api/family-todo/spaces/1/lists/reorder'
    const req = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
    req.nextUrl = new URL(url)
    return req
  }

  it('reorders lists', async () => {
    const res = await PATCH(makeReq({ ids: [2, 1, 3] }), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(todoService.reorderLists).toHaveBeenCalledWith(1, [2, 1, 3])
  })

  it('returns 400 when ids is not an array', async () => {
    const res = await PATCH(makeReq({ ids: 'bad' }), { user })
    expect(res.status).toBe(400)
  })

  it('returns 400 when ids is empty', async () => {
    const res = await PATCH(makeReq({ ids: [] }), { user })
    expect(res.status).toBe(400)
  })
})
