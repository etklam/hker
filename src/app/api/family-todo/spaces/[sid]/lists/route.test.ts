import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/family-todo-service', () => ({
  createList: vi.fn(),
}))

describe('POST /api/family-todo/spaces/[sid]/lists', () => {
  let POST: any
  let todoService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    todoService = await import('@/server/services/family-todo-service')
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

  it('creates list and returns 201', async () => {
    todoService.createList.mockResolvedValue({
      id: 1, spaceId: 1, title: 'Groceries', sortOrder: 0, createdAt: new Date(),
    })
    const res = await POST(makeReq('/api/family-todo/spaces/1/lists', { title: 'Groceries' }), { user })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Groceries')
  })

  it('returns 400 for missing title', async () => {
    const res = await POST(makeReq('/api/family-todo/spaces/1/lists', {}), { user })
    expect(res.status).toBe(400)
  })
})
