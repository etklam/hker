import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

vi.mock('@/server/api-helpers', () => ({
  withAdmin: (handler: any) => handler,
  withSuperAdmin: (handler: any) => handler,
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

describe('PUT /api/admin/users/[id]/role', () => {
  let PUT: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./[id]/role/route')
    PUT = mod.PUT
  })

  function makeReq(id: number, body: any) {
    return new Request(`http://localhost:3000/api/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }) as any
  }

  it('allows superadmin to update user role to admin', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 2, role: 'admin' }]),
        }),
      }),
    } as any)

    const res = await PUT(makeReq(2, { role: 'admin' }), { user: { id: 1, role: 'superadmin' } })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
  })

  it('allows superadmin to update user role to superadmin', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 2, role: 'superadmin' }]),
        }),
      }),
    } as any)

    const res = await PUT(makeReq(2, { role: 'superadmin' }), { user: { id: 1, role: 'superadmin' } })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
  })

  it('allows superadmin to demote admin to user', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 2, role: 'user' }]),
        }),
      }),
    } as any)

    const res = await PUT(makeReq(2, { role: 'user' }), { user: { id: 1, role: 'superadmin' } })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
  })

  it('returns 400 for invalid role', async () => {
    const res = await PUT(makeReq(2, { role: 'invalid' }), { user: { id: 1, role: 'superadmin' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when trying to update own role', async () => {
    const res = await PUT(makeReq(1, { role: 'admin' }), { user: { id: 1, role: 'superadmin' } })
    expect(res.status).toBe(400)
  })
})
