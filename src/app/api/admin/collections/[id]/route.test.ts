import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

vi.mock('@/server/api-helpers', () => ({
  withAdmin: (handler: any) => handler,
  withSuperAdmin: (handler: any) => handler,
}))

describe('DELETE /api/admin/collections/[id]', () => {
  let DELETE: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    DELETE = mod.DELETE
  })

  function makeReq(id: number) {
    return new Request(`http://localhost:3000/api/admin/collections/${id}`, {
      method: 'DELETE',
    }) as any
  }

  it('deletes a collection', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 1, title: 'Test', ownerId: 2 }]),
        }),
      }),
    } as any)

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as any)

    const res = await DELETE(makeReq(1), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(204)
  })

  it('returns 404 for non-existent collection', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    } as any)

    const res = await DELETE(makeReq(999), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid collection ID', async () => {
    const res = await DELETE(
      new Request('http://localhost:3000/api/admin/collections/abc', { method: 'DELETE' }) as any,
      { user: { id: 1, role: 'admin' } },
    )
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/collections/[id]', () => {
  let PUT: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PUT = mod.PUT
  })

  function makeReq(id: number, body: any) {
    return new Request(`http://localhost:3000/api/admin/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }) as any
  }

  it('updates a collection title', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 1, title: 'Old Title', description: 'desc', icon: null }]),
        }),
      }),
    } as any)

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, title: 'New Title', description: 'desc', icon: null }]),
        }),
      }),
    } as any)

    const res = await PUT(makeReq(1, { title: 'New Title' }), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collection.title).toBe('New Title')
  })

  it('returns 404 for non-existent collection', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    } as any)

    const res = await PUT(makeReq(999, { title: 'Test' }), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 when nothing to update', async () => {
    const res = await PUT(makeReq(1, {}), { user: { id: 1, role: 'admin' } })
    expect(res.status).toBe(400)
  })
})
