import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/monthly-bill-service', () => ({
  updateList: vi.fn(),
  removeList: vi.fn(),
}))

function makeReq(method: string, body: any) {
  const url = 'http://localhost:3000/api/monthly-bills/lists/5'
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : undefined,
  }) as any
  req.nextUrl = new URL(url)
  return req
}

describe('/api/monthly-bills/lists/[listId]', () => {
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
    it('returns 200 with updated list', async () => {
      service.updateList.mockResolvedValue({ id: 5, name: 'Renamed' })

      const res = await PATCH(makeReq('PATCH', { name: 'Renamed' }), { user })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe('Renamed')
    })

    it('returns 403 when service throws FORBIDDEN', async () => {
      service.updateList.mockRejectedValue(new AppError('FORBIDDEN', 'Not owner'))

      const res = await PATCH(makeReq('PATCH', { name: 'X' }), { user })

      expect(res.status).toBe(403)
    })

    it('returns 404 when service throws NOT_FOUND', async () => {
      service.updateList.mockRejectedValue(new AppError('NOT_FOUND', 'Missing'))

      const res = await PATCH(makeReq('PATCH', { name: 'X' }), { user })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('returns 204 on success', async () => {
      service.removeList.mockResolvedValue(undefined)

      const res = await DELETE(makeReq('DELETE', null), { user })

      expect(res.status).toBe(204)
    })

    it('returns 403 when service throws FORBIDDEN', async () => {
      service.removeList.mockRejectedValue(new AppError('FORBIDDEN', 'Not owner'))

      const res = await DELETE(makeReq('DELETE', null), { user })

      expect(res.status).toBe(403)
    })
  })
})
