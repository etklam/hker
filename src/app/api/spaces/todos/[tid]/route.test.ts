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
  updateTodo: vi.fn(),
  removeTodo: vi.fn(),
}))

vi.mock('@/server/services/space-board-service', () => ({
  buildTodoResponse: vi.fn(),
}))

describe('/api/spaces/todos/[tid]', () => {
  let PATCH: any, DELETE: any
  let todoService: any
  let boardService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    todoService = await import('@/server/services/space-todo-service')
    boardService = await import('@/server/services/space-board-service')
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
    it('updates todo', async () => {
      todoService.getSpaceIdForTodo.mockResolvedValue(1)
      const mockTodo = { id: 1, title: 'Updated', completed: false, createdBy: 1 }
      todoService.updateTodo.mockResolvedValue(mockTodo)
      boardService.buildTodoResponse.mockResolvedValue({ id: 1, title: 'Updated' })
      const res = await PATCH(makeReq('/api/spaces/todos/1', { title: 'Updated' }), { user })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.title).toBe('Updated')
    })

    it('returns 400 for invalid priority', async () => {
      todoService.getSpaceIdForTodo.mockResolvedValue(1)
      const res = await PATCH(makeReq('/api/spaces/todos/1', { priority: 'critical' }), { user })
      expect(res.status).toBe(400)
    })

    it('returns 404 for missing todo', async () => {
      todoService.getSpaceIdForTodo.mockResolvedValue(null)
      const res = await PATCH(makeReq('/api/spaces/todos/999', { title: 'X' }), { user })
      expect(res.status).toBe(404)
    })

    it('returns 404 when update finds nothing', async () => {
      todoService.getSpaceIdForTodo.mockResolvedValue(1)
      todoService.updateTodo.mockResolvedValue(null)
      const res = await PATCH(makeReq('/api/spaces/todos/999', { title: 'X' }), { user })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('deletes todo and returns 204', async () => {
      todoService.getSpaceIdForTodo.mockResolvedValue(1)
      const res = await DELETE(makeReq('/api/spaces/todos/1'), { user })
      expect(res.status).toBe(204)
      expect(todoService.removeTodo).toHaveBeenCalledWith(1)
    })

    it('returns 404 for missing todo', async () => {
      todoService.getSpaceIdForTodo.mockResolvedValue(null)
      const res = await DELETE(makeReq('/api/spaces/todos/999'), { user })
      expect(res.status).toBe(404)
    })
  })
})
