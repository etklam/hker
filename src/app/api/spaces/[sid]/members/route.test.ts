import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
  requireSpaceAtLeast: vi.fn(),
}))

vi.mock('@/server/services/space-service', () => ({
  listMembers: vi.fn(),
}))

describe('GET /api/spaces/[sid]/members', () => {
  let GET: any
  let spaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    spaceService = await import('@/server/services/space-service')
  })

  it('returns members for space', async () => {
    spaceService.listMembers.mockResolvedValue([{ id: 1, role: 'owner' }])
    const req = new Request('http://localhost:3000/api/spaces/1/members') as any
    req.nextUrl = new URL('http://localhost:3000/api/spaces/1/members')
    const res = await GET(req, { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
