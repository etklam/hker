import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/marketplace-service', () => ({
  publish: vi.fn(),
}))

describe('POST /api/marketplace/publish/[collectionId]', () => {
  let POST: any
  let marketplaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    marketplaceService = await import('@/server/services/marketplace-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`, { method: 'POST' }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('publishes collection', async () => {
    marketplaceService.publish.mockResolvedValue({ id: 1, collectionId: 5 })
    const res = await POST(makeReq('/api/marketplace/publish/5'), { user })
    expect(res.status).toBe(201)
    expect(marketplaceService.publish).toHaveBeenCalledWith(5, 1, false)
  })

  it('publishes anonymously', async () => {
    marketplaceService.publish.mockResolvedValue({ id: 1, collectionId: 5 })
    const res = await POST(makeReq('/api/marketplace/publish/5?anonymous=true'), { user })
    expect(res.status).toBe(201)
    expect(marketplaceService.publish).toHaveBeenCalledWith(5, 1, true)
  })

  it('returns 400 for invalid collection id', async () => {
    const res = await POST(makeReq('/api/marketplace/publish/abc'), { user })
    expect(res.status).toBe(400)
  })

  it('handles permission error', async () => {
    const { requireAtLeast } = await import('@/server/services/permission-service')
    vi.mocked(requireAtLeast).mockImplementation(() => { throw new AppError('FORBIDDEN', 'No access') })
    const res = await POST(makeReq('/api/marketplace/publish/5'), { user })
    expect(res.status).toBe(403)
  })
})
