import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/monthly-bill-service', () => ({
  createItem: vi.fn(),
}))

function makeReq(body: any) {
  const url = 'http://localhost:3000/api/monthly-bills/lists/5/items'
  const req = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
  req.nextUrl = new URL(url)
  return req
}

describe('/api/monthly-bills/lists/[listId]/items', () => {
  let POST: any
  let service: any
  const user = { id: 7 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    service = await import('@/server/services/monthly-bill-service')
  })

  it('returns 201 when item is created', async () => {
    service.createItem.mockResolvedValue({ id: 12, name: 'Rent', dueDay: 5 })

    const res = await POST(makeReq({ name: 'Rent', dueDay: 5 }), { user })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Rent')
  })

  it('returns 400 when dueDay is over 31', async () => {
    const res = await POST(makeReq({ name: 'Rent', dueDay: 32 }), { user })

    expect(res.status).toBe(400)
    expect(service.createItem).not.toHaveBeenCalled()
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ dueDay: 5 }), { user })

    expect(res.status).toBe(400)
    expect(service.createItem).not.toHaveBeenCalled()
  })

  it('returns 403 when service throws FORBIDDEN', async () => {
    service.createItem.mockRejectedValue(new AppError('FORBIDDEN', 'Member'))

    const res = await POST(makeReq({ name: 'Rent', dueDay: 5 }), { user })

    expect(res.status).toBe(403)
  })
})
