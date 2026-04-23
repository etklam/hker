import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/collection-service', () => ({
  updateVisibility: vi.fn(),
}))

describe('PATCH /api/me/collections/[id]/visibility', () => {
  let PATCH: any
  let collectionService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    collectionService = await import('@/server/services/collection-service')
  })

  function makeReq(body: any) {
    const url = 'http://localhost:3000/api/me/collections/1/visibility'
    const req = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
    req.nextUrl = new URL(url)
    return req
  }

  it('updates visibility to public', async () => {
    collectionService.updateVisibility.mockResolvedValue({ id: 1, visibility: 'public' })
    const res = await PATCH(makeReq({ visibility: 'public' }), { user })
    expect(res.status).toBe(200)
    expect(collectionService.updateVisibility).toHaveBeenCalledWith(1, 'public')
  })

  it('returns 400 for invalid visibility', async () => {
    const res = await PATCH(makeReq({ visibility: 'invalid' }), { user })
    expect(res.status).toBe(400)
  })

  it('returns 404 when collection not found', async () => {
    collectionService.updateVisibility.mockResolvedValue(null)
    const res = await PATCH(makeReq({ visibility: 'public' }), { user })
    expect(res.status).toBe(404)
  })
})
