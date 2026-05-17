import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-todo-service', () => ({
  getSpaceIdForList: vi.fn(),
  createTodo: vi.fn(),
}))

vi.mock('@/server/services/space-board-service', () => ({
  buildTodoResponse: vi.fn(),
}))

describe('POST /api/spaces/lists/[lid]/todos', () => {
  let POST: any
  let todoService: any
  let boardService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    todoService = await import('@/server/services/space-todo-service')
    boardService = await import('@/server/services/space-board-service')
  })

  function makeReq(url: string, body?: any) {
    const req = new Request(`http://localhost:3000${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('returns 400 for missing title', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(1)
    const res = await POST(makeReq('/api/spaces/lists/1/todos', {}), { user })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid priority', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(1)
    const res = await POST(makeReq('/api/spaces/lists/1/todos', { title: 'Task', priority: 'critical' }), { user })
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing list', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(null)
    const res = await POST(makeReq('/api/spaces/lists/999/todos', { title: 'Task' }), { user })
    expect(res.status).toBe(404)
  })

  it('creates todo and returns 201', async () => {
    todoService.getSpaceIdForList.mockResolvedValue(1)
    const mockTodo = { id: 1, listId: 1, title: 'Task', completed: false, createdBy: 1 }
    todoService.createTodo.mockResolvedValue(mockTodo)
    boardService.buildTodoResponse.mockResolvedValue({ id: 1, title: 'Task', createdBy: { displayName: 'User' } })
    const res = await POST(makeReq('/api/spaces/lists/1/todos', { title: 'Task' }), { user })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Task')
  })
})
