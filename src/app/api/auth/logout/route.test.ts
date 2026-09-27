import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/server/services/session-service', () => ({
  destroySession: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  SESSION_COOKIE_NAME: '__Host-hker_session',
  clearSessionCookie: vi.fn().mockReturnValue('cleared-cookie'),
}))

describe('POST /api/auth/logout', () => {
  let POST: any
  let sessionService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./route')
    POST = mod.POST
    sessionService = await import('@/server/services/session-service')
  })

  function makeReq(cookieValue?: string) {
    const req = new Request('http://localhost:3000/api/auth/logout', { method: 'POST' }) as any
    req.cookies = { get: vi.fn().mockReturnValue(cookieValue ? { value: cookieValue } : undefined) }
    return req
  }

  it('destroys session and returns 204', async () => {
    const req = makeReq('session-token')
    const res = await POST(req, { user: { id: 1 } })
    expect(res.status).toBe(204)
    expect(req.cookies.get).toHaveBeenCalledWith('__Host-hker_session')
    expect(sessionService.destroySession).toHaveBeenCalledWith('session-token')
  })

  it('handles missing session cookie', async () => {
    const res = await POST(makeReq(), { user: { id: 1 } })
    expect(res.status).toBe(204)
    expect(sessionService.destroySession).not.toHaveBeenCalled()
  })
})
