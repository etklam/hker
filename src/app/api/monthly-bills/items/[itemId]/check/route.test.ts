import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/monthly-bill-service', () => ({
  setItemChecked: vi.fn(),
}))

function makeReq(body: any) {
  const url = 'http://localhost:3000/api/monthly-bills/items/12/check'
  const req = new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
  req.nextUrl = new URL(url)
  return req
}

describe('/api/monthly-bills/items/[itemId]/check', () => {
  let PATCH: any
  let service: any
  const user = { id: 7 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    service = await import('@/server/services/monthly-bill-service')
  })

  it('sets monthly checked state', async () => {
    service.setItemChecked.mockResolvedValue(undefined)

    const res = await PATCH(makeReq({ year: 2026, month: 4, checked: true }), { user })

    expect(res.status).toBe(204)
    expect(service.setItemChecked).toHaveBeenCalledWith(7, 12, { year: 2026, month: 4 }, true)
  })

  it('requires a boolean checked value', async () => {
    const res = await PATCH(makeReq({ year: 2026, month: 4 }), { user })

    expect(res.status).toBe(400)
    expect(service.setItemChecked).not.toHaveBeenCalled()
  })
})
