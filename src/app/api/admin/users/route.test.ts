import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

vi.mock('@/server/api-helpers', () => ({
  withAdmin: (handler: any) => handler,
}))

describe('GET /api/admin/users', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
  })

  function makeReq(params?: string) {
    return new Request(`http://localhost:3000/api/admin/users${params ?? ''}`) as any
  }

  it('returns paginated users', async () => {
    vi.mocked(db.select).mockImplementation((() => {
      let callIdx = 0
      return () => {
        callIdx++
        const fromChain = {
          where: () => ({ limit: () => ({ offset: () => Promise.resolve([{ id: 1, email: 'test@test.com', displayName: 'Test', avatarUrl: null, role: 'user', createdAt: new Date(), updatedAt: new Date() }]) }) }),
          orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve([{ id: 1, email: 'test@test.com', displayName: 'Test', avatarUrl: null, role: 'user', createdAt: new Date(), updatedAt: new Date() }]) }) }),
        }
        if (callIdx === 1) {
          // count query
          return { from: () => Promise.resolve([{ count: 5 }]) }
        }
        // data query
        return { from: () => fromChain }
      }
    })() as any)

    const res = await GET(makeReq(), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toBeDefined()
    expect(body.total).toBe(5)
    expect(body.page).toBe(1)
  })
})
