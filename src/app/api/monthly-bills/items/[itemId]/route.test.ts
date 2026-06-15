import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/monthly-bill-service', () => ({
  updateItem: vi.fn(),
  removeItem: vi.fn(),
}))

function makeReq(method: string, body: any) {
  const url = 'http://localhost:3000/api/monthly-bills/items/12'
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : undefined,
  }) as any
  req.nextUrl = new URL(url)
  return req
}

describe('/api/monthly-bills/items/[itemId]', () => {
  let PATCH: any, DELETE: any
  let service: any
  const user = { id: 7 }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    PATCH = mod.PATCH
    DELETE = mod.DELETE
    service = await import('@/server/services/monthly-bill-service')
  })

  describe('PATCH', () => {
    it('returns 200 with updated item', async () => {
      service.updateItem.mockResolvedValue({ id: 12, name: 'Rent Updated' })

      const res = await PATCH(makeReq('PATCH', { name: 'Rent Updated' }), { user })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe('Rent Updated')
    })

    it('returns 400 when dueDay is invalid', async () => {
      const res = await PATCH(makeReq('PATCH', { dueDay: 99 }), { user })

      expect(res.status).toBe(400)
      expect(service.updateItem).not.toHaveBeenCalled()
    })

    it('returns 403 when service throws FORBIDDEN', async () => {
      service.updateItem.mockRejectedValue(new AppError('FORBIDDEN', 'Member'))

      const res = await PATCH(makeReq('PATCH', { name: 'X' }), { user })

      expect(res.status).toBe(403)
    })

    it('returns 404 when service throws NOT_FOUND', async () => {
      service.updateItem.mockRejectedValue(new AppError('NOT_FOUND', 'Missing'))

      const res = await PATCH(makeReq('PATCH', { name: 'X' }), { user })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('returns 204 on success', async () => {
      service.removeItem.mockResolvedValue(undefined)

      const res = await DELETE(makeReq('DELETE', null), { user })

      expect(res.status).toBe(204)
    })

    it('returns 403 when service throws FORBIDDEN', async () => {
      service.removeItem.mockRejectedValue(new AppError('FORBIDDEN', 'Member'))

      const res = await DELETE(makeReq('DELETE', null), { user })

      expect(res.status).toBe(403)
    })
  })
})
