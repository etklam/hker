import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/monthly-bill-service', () => ({
  createList: vi.fn(),
}))

function makeReq(body: any) {
  const url = 'http://localhost:3000/api/monthly-bills/lists'
  const req = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
  req.nextUrl = new URL(url)
  return req
}

describe('/api/monthly-bills/lists', () => {
  let POST: any
  let service: any
  const user = { id: 7 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    service = await import('@/server/services/monthly-bill-service')
  })

  it('returns 201 when list is created', async () => {
    service.createList.mockResolvedValue({ id: 1, name: 'Bills', ownerId: 7 })

    const res = await POST(makeReq({ name: 'Bills' }), { user })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Bills')
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({}), { user })

    expect(res.status).toBe(400)
    expect(service.createList).not.toHaveBeenCalled()
  })

  it('returns 400 when name is empty', async () => {
    const res = await POST(makeReq({ name: '   ' }), { user })

    expect(res.status).toBe(400)
    expect(service.createList).not.toHaveBeenCalled()
  })

  it('returns 403 when service throws FORBIDDEN', async () => {
    service.createList.mockRejectedValue(new AppError('FORBIDDEN', 'No access'))

    const res = await POST(makeReq({ name: 'Bills', sharedSpaceId: 99 }), { user })

    expect(res.status).toBe(403)
  })
})
