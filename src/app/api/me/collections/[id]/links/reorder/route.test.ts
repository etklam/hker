import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/permission-service', () => ({
  getCollectionAccess: vi.fn(),
  requireAtLeast: vi.fn(),
}))

vi.mock('@/server/services/link-service', () => ({
  reorder: vi.fn(),
}))

describe('PATCH /api/me/collections/[id]/links/reorder', () => {
  let PATCH: any
  let linkService: any
  const user = { id: 1 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    linkService = await import('@/server/services/link-service')
  })

  function makeReq(body: any) {
    const url = 'http://localhost:3000/api/me/collections/1/links/reorder'
    const req = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
    req.nextUrl = new URL(url)
    return req
  }

  it('reorders links', async () => {
    const res = await PATCH(makeReq({ ids: [3, 1, 2] }), { user })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(linkService.reorder).toHaveBeenCalledWith(1, [3, 1, 2])
  })

  it('returns 400 when ids is not an array', async () => {
    const res = await PATCH(makeReq({ ids: 'bad' }), { user })
    expect(res.status).toBe(400)
  })

  it('returns 400 when ids contains non-numbers', async () => {
    const res = await PATCH(makeReq({ ids: [1, 'two', 3] }), { user })
    expect(res.status).toBe(400)
  })
})
