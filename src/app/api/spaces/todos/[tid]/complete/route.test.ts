import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-todo-service', () => ({
  getSpaceIdForTodo: vi.fn(),
  toggleComplete: vi.fn(),
}))

vi.mock('@/server/services/space-board-service', () => ({
  buildTodoResponse: vi.fn(),
}))

describe('PATCH /api/spaces/todos/[tid]/complete', () => {
  let PATCH: any
  let todoService: any
  let boardService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    todoService = await import('@/server/services/space-todo-service')
    boardService = await import('@/server/services/space-board-service')
  })

  function makeReq(url: string, body: any) {
    const req = new Request(`http://localhost:3000${url}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('toggles complete', async () => {
    todoService.getSpaceIdForTodo.mockResolvedValue(1)
    const mockTodo = { id: 1, completed: true, completedBy: 1, createdBy: 1 }
    todoService.toggleComplete.mockResolvedValue(mockTodo)
    boardService.buildTodoResponse.mockResolvedValue({ id: 1, completed: true })
    const res = await PATCH(makeReq('/api/spaces/todos/1/complete', { completed: true }), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completed).toBe(true)
  })

  it('returns 400 when completed is not boolean', async () => {
    todoService.getSpaceIdForTodo.mockResolvedValue(1)
    const res = await PATCH(makeReq('/api/spaces/todos/1/complete', { completed: 'yes' }), { user })
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing todo', async () => {
    todoService.getSpaceIdForTodo.mockResolvedValue(null)
    const res = await PATCH(makeReq('/api/spaces/todos/999/complete', { completed: true }), { user })
    expect(res.status).toBe(404)
  })
})
