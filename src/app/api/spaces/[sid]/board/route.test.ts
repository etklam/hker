import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-board-service', () => ({
  getBoardData: vi.fn(),
}))

describe('GET /api/spaces/[sid]/board', () => {
  let GET: any
  let boardService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    boardService = await import('@/server/services/space-board-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('returns board data', async () => {
    boardService.getBoardData.mockResolvedValue({
      space: { id: 1, name: 'Family', role: 'owner' },
      lists: [], todos: [],
    })
    const res = await GET(makeReq('/api/spaces/1/board'), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.space.name).toBe('Family')
  })
})
