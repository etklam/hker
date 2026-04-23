import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

vi.mock('@/server/api-helpers', () => ({
  withAdmin: (handler: any) => handler,
}))

describe('GET /api/admin/stats', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
  })

  it('returns stats counts', async () => {
    let callIdx = 0
    const impl = () => {
      callIdx++
      return { from: () => Promise.resolve([{ count: callIdx === 1 ? 10 : callIdx === 2 ? 20 : 30 }]) }
    }
    vi.mocked(db.select).mockImplementation(impl as any)

    const res = await GET(new Request('http://localhost:3000/api/admin/stats') as any, { user: { id: 1 } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toBe(10)
    expect(body.collections).toBe(20)
    expect(body.links).toBe(30)
  })
})
