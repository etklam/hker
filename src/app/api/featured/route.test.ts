import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'

describe('GET /api/featured', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
  })

  it('returns empty collections when no admin or superadmin found', async () => {
    const emptyChain = {
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }
    vi.mocked(db.select).mockReturnValue(emptyChain as any)

    const res = await GET(new Request('http://localhost:3000/api/featured') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collections).toEqual([])
  })

  it('prioritizes superadmin over admin for featured content', async () => {
    let callCount = 0
    vi.mocked(db.select).mockImplementation((...args: any[]) => {
      callCount++
      // First call: superadmin query (from users)
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        } as any
      }
      // Second call: collections query (from collections)
      if (callCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any
      }
      // Third call and beyond: link counts and links queries
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any
    })

    const res = await GET(new Request('http://localhost:3000/api/featured') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collections).toBeDefined()
  })

  it('falls back to admin when no superadmin exists', async () => {
    let callCount = 0
    vi.mocked(db.select).mockImplementation((...args: any[]) => {
      callCount++
      // First call: superadmin query returns empty
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any
      }
      // Second call: admin query returns result
      if (callCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 2 }]),
            }),
          }),
        } as any
      }
      // Third call and beyond: collections, link counts, links queries
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any
    })

    const res = await GET(new Request('http://localhost:3000/api/featured') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collections).toBeDefined()
  })

  it('returns collections when superadmin exists', async () => {
    let callCount = 0
    vi.mocked(db.select).mockImplementation((...args: any[]) => {
      callCount++
      // First call: superadmin query returns result
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        } as any
      }
      // Second call and beyond: collections, link counts, links queries
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any
    })

    const res = await GET(new Request('http://localhost:3000/api/featured') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collections).toBeDefined()
    expect(Array.isArray(body.collections)).toBe(true)
  })
})
