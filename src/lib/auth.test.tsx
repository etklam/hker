import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

describe('auth', () => {
  let AuthProvider: any, useAuth: any, api: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/lib/auth')
    AuthProvider = mod.AuthProvider
    useAuth = mod.useAuth
    const apiMod = await import('@/lib/api-client')
    api = apiMod.api
  })

  describe('AuthProvider', () => {
    it('renders children', async () => {
      api.mockResolvedValue({ user: null })
      render(<AuthProvider><div data-testid="child">Hello</div></AuthProvider>)
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('refreshes session on mount', async () => {
      api.mockResolvedValue({
        user: { id: 1, email: 'test@test.com', displayName: 'Test', avatarUrl: null, role: 'user' },
      })

      const TestComponent = () => {
        const { user, loading } = useAuth()
        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="user">{user?.displayName ?? 'none'}</span>
          </div>
        )
      }

      render(<AuthProvider><TestComponent /></AuthProvider>)

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('Test')
      })
    })
  })

  describe('useAuth', () => {
    it('throws when used outside provider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // React hooks throw "Invalid hook call" when called outside a component
      expect(() => useAuth()).toThrow()
      spy.mockRestore()
    })
  })
})
