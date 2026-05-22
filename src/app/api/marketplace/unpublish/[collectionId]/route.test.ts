import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
}))

vi.mock('@/server/services/marketplace-service', () => ({
  unpublish: vi.fn(),
}))

vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('DELETE /api/marketplace/unpublish/[collectionId]', () => {
  let DELETE: any
  let marketplaceService: any
  let permissionService: any
  let db: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    DELETE = mod.DELETE
    marketplaceService = await import('@/server/services/marketplace-service')
    permissionService = await import('@/server/services/permission-service')
    db = await import('@/server/db')
    db = db.db
  })

  function makeReq(url: string) {
    const req = new Request(`http://localhost:3000${url}`, { method: 'DELETE' }) as any
    req.nextUrl = new URL(`http://localhost:3000${url}`)
    return req
  }

  function mockDbSelect(publisherId: number | null) {
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            publisherId ? [{ publisherId }] : [],
          ),
        }),
      }),
    })
  }

  it('allows owner to unpublish', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('owner')
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(200)
    expect(marketplaceService.unpublish).toHaveBeenCalledWith(5)
  })

  it('allows editor to unpublish', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('edit')
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(200)
    expect(marketplaceService.unpublish).toHaveBeenCalledWith(5)
  })

  it('allows original publisher with no collection access to unpublish', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('none')
    mockDbSelect(1) // user.id === publisherId
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(200)
    expect(marketplaceService.unpublish).toHaveBeenCalledWith(5)
  })

  it('denies non-publisher with view access', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('view')
    mockDbSelect(2) // different user
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(403)
    expect(marketplaceService.unpublish).not.toHaveBeenCalled()
  })

  it('denies non-publisher with no listing', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('none')
    mockDbSelect(null) // no listing exists
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(403)
    expect(marketplaceService.unpublish).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid collection id', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('owner')
    const res = await DELETE(makeReq('/api/marketplace/unpublish/abc'), { user })
    expect(res.status).toBe(400)
  })

  it('handles service error', async () => {
    vi.mocked(permissionService.getCollectionAccess).mockResolvedValue('owner')
    marketplaceService.unpublish.mockRejectedValue(new AppError('NOT_FOUND', 'Listing not found'))
    const res = await DELETE(makeReq('/api/marketplace/unpublish/5'), { user })
    expect(res.status).toBe(404)
  })
})
