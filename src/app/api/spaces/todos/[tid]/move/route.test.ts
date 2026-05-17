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
  moveTodo: vi.fn(),
}))

vi.mock('@/server/services/space-board-service', () => ({
  buildTodoResponse: vi.fn(),
}))

describe('PATCH /api/spaces/todos/[tid]/move', () => {
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

  it('moves todo to another list', async () => {
    todoService.getSpaceIdForTodo.mockResolvedValue(1)
    const mockTodo = { id: 1, listId: 2, title: 'Task', createdBy: 1 }
    todoService.moveTodo.mockResolvedValue(mockTodo)
    boardService.buildTodoResponse.mockResolvedValue({ id: 1, listId: 2 })
    const res = await PATCH(makeReq('/api/spaces/todos/1/move', { targetListId: 2 }), { user })
    expect(res.status).toBe(200)
    expect(todoService.moveTodo).toHaveBeenCalledWith(1, 2)
  })

  it('returns 400 when targetListId is missing', async () => {
    todoService.getSpaceIdForTodo.mockResolvedValue(1)
    const res = await PATCH(makeReq('/api/spaces/todos/1/move', {}), { user })
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing todo', async () => {
    todoService.getSpaceIdForTodo.mockResolvedValue(null)
    const res = await PATCH(makeReq('/api/spaces/todos/999/move', { targetListId: 2 }), { user })
    expect(res.status).toBe(404)
  })
})
