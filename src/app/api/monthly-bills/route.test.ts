import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/monthly-bill-service', () => ({
  getBoard: vi.fn(),
}))

function makeReq(url: string) {
  const req = new Request(url) as any
  req.nextUrl = new URL(url)
  return req
}

describe('/api/monthly-bills', () => {
  let GET: any
  let service: any
  const user = { id: 7 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    GET = mod.GET
    service = await import('@/server/services/monthly-bill-service')
  })

  it('returns a board for the requested month and list', async () => {
    service.getBoard.mockResolvedValue({
      period: { year: 2026, month: 4 },
      lists: [],
      activeList: null,
      items: [],
    })

    const res = await GET(makeReq('http://localhost:3000/api/monthly-bills?year=2026&month=4&listId=9'), { user })

    expect(res.status).toBe(200)
    expect(service.getBoard).toHaveBeenCalledWith(7, { listId: 9, year: 2026, month: 4 })
  })

  it('rejects an invalid month', async () => {
    const res = await GET(makeReq('http://localhost:3000/api/monthly-bills?year=2026&month=13'), { user })

    expect(res.status).toBe(400)
    expect(service.getBoard).not.toHaveBeenCalled()
  })
})
