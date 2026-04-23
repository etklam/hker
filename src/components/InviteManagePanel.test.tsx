import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'invites.title') return 'Invites'
      if (key === 'invites.subtitle') return 'Manage invites'
      if (key === 'invites.loading') return 'Loading...'
      if (key === 'invites.empty') return 'No invites'
      if (key === 'invites.create') return 'Create'
      if (key === 'invites.roleLabel') return 'Role'
      if (key === 'invites.maxUsesLabel') return 'Max Uses'
      if (key === 'invites.expiresLabel') return 'Expires'
      if (key === 'invites.role.viewer') return 'Viewer'
      if (key === 'invites.role.editor') return 'Editor'
      if (key === 'invites.errors.load') return 'Load error'
      return key
    },
  }),
}))

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({
  pushToast: vi.fn(),
}))

describe('InviteManagePanel', () => {
  let InviteManagePanel: any
  let api: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/components/InviteManagePanel')
    InviteManagePanel = mod.InviteManagePanel
    const apiMod = await import('@/lib/api-client')
    api = apiMod.api
  })

  it('shows loading state', () => {
    api.mockReturnValue(new Promise(() => {}))
    render(<InviteManagePanel collectionId={1} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    api.mockResolvedValue([])
    render(<InviteManagePanel collectionId={1} />)
    await waitFor(() => {
      expect(screen.getByText('No invites')).toBeInTheDocument()
    })
  })

  it('renders invites', async () => {
    api.mockResolvedValue([
      { id: 1, token: 'abc', role: 'viewer', maxUses: null, useCount: 0, expiresAt: null, createdAt: '2025-01-01', url: 'http://localhost:3000/invite/abc' },
    ])
    render(<InviteManagePanel collectionId={1} />)
    await waitFor(() => {
      expect(screen.getByText('Invites')).toBeInTheDocument()
    })
  })
})
