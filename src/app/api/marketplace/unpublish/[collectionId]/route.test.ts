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
  unpublish: vi.fn(),
}))

describe('DELETE /api/marketplace/unpublish/[collectionId]', () => {
  let DELETE: any
  let marketplaceService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    DELETE = mod.DELETE
    marketplaceService = await import('@/server/services/marketplace-service')
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`, { method: 'DELETE' }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  it('unpublishes collection', async () => {
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(marketplaceService.unpublish).toHaveBeenCalledWith(5)
  })

  it('returns 400 for invalid collection id', async () => {
    const res = await DELETE(makeReq('/api/marketplace/unpublish/abc'), { user })
    expect(res.status).toBe(400)
  })

  it('handles permission error', async () => {
    const { requireAtLeast } = await import('@/server/services/permission-service')
    vi.mocked(requireAtLeast).mockImplementation(() => { throw new AppError('FORBIDDEN', 'No access') })
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(403)
  })
})
