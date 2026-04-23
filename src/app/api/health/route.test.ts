import { describe, it, expect } from 'vitest'

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.service).toBe('hker')
    expect(body.time).toBeDefined()
  })
})
