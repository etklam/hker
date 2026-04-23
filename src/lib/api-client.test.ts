import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the toast module
vi.mock('@/lib/toast', () => ({
  pushToast: vi.fn(),
}))

describe('api-client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('api', () => {
    it('makes GET request and returns data', async () => {
      const mockData = { items: [1, 2, 3] }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      }))

      const { api } = await import('@/lib/api-client')
      const result = await api('/api/test')

      expect(result).toEqual(mockData)
    })

    it('makes POST request with JSON body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1 }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const { api } = await import('@/lib/api-client')
      await api('/api/test', { method: 'POST', body: { name: 'test' } })

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ name: 'test' }),
      }))
    })

    it('returns undefined for 204 response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }))

      const { api } = await import('@/lib/api-client')
      const result = await api('/api/test')

      expect(result).toBeUndefined()
    })

    it('throws and pushes toast on error response', async () => {
      const { pushToast } = await import('@/lib/toast')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad request' }),
      }))

      const { api } = await import('@/lib/api-client')
      await expect(api('/api/test')).rejects.toThrow('Bad request')
      expect(pushToast).toHaveBeenCalledWith('Bad request', 'error')
    })

    it('throws generic message when error has no message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }))

      const { api } = await import('@/lib/api-client')
      await expect(api('/api/test')).rejects.toThrow('Request failed (500)')
    })
  })
})
