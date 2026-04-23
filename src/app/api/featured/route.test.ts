import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

describe('GET /api/featured', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
  })

  it('returns empty collections when no admin found', async () => {
    const emptyChain = {
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }
    vi.mocked(db.select).mockReturnValue(emptyChain as any)

    const res = await GET(new Request('http://localhost:3000/api/featured') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collections).toEqual([])
  })
})
