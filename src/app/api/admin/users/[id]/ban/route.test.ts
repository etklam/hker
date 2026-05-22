import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

vi.mock('@/server/api-helpers', () => ({
  withAdmin: (handler: any) => handler,
  withSuperAdmin: (handler: any) => handler,
}))

describe('POST /api/admin/users/[id]/ban', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
  })

  function makeReq(id: number) {
    return new Request(`http://localhost:3000/api/admin/users/${id}/ban`, {
      method: 'POST',
    }) as any
  }

  it('bans a user', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 2, role: 'user' }]),
        }),
      }),
    } as any)

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 2, role: 'user', banned: true }]),
        }),
      }),
    } as any)

    const res = await POST(makeReq(2), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.banned).toBe(true)
  })

  it('returns 400 when banning self', async () => {
    const res = await POST(makeReq(1), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when banning superadmin', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 2, role: 'superadmin' }]),
        }),
      }),
    } as any)

    const res = await POST(makeReq(2), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent user', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    } as any)

    const res = await POST(makeReq(999), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid user ID', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/admin/users/abc/ban', { method: 'POST' }) as any,
      { user: { id: 1, role: 'admin' } },
    )
    expect(res.status).toBe(400)
  })
})
