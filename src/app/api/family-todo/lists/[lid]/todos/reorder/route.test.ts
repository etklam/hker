import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/family-todo-service', () => ({
  getSpaceIdForList: vi.fn(),
  reorderTodos: vi.fn(),
}))

describe('PATCH /api/family-todo/lists/[lid]/todos/reorder', () => {
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
    const url = 'http://localhost:3000/api/family-todo/lists/1/todos/reorder'
    const req = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
    req.nextUrl = new URL(url)
    return req
  }

  it('reorders todos', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(1)
    const res = await PATCH(makeReq({ ids: [3, 1, 2] }), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(todoService.reorderTodos).toHaveBeenCalledWith(1, [3, 1, 2])
  })

  it('returns 400 when ids is not an array', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(1)
    const res = await PATCH(makeReq({ ids: 'bad' }), { user })
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing list', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(null)
    const res = await PATCH(makeReq({ ids: [1] }), { user })
    expect(res.status).toBe(404)
  })
})
