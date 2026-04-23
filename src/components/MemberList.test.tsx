import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (key === 'members.title') return 'Members'
      if (key === 'members.subtitle') return 'Manage members'
      if (key === 'members.loading') return 'Loading...'
      if (key === 'members.empty') return 'No members'
      if (key === 'members.userFallback') return `User #${opts?.id}`
      if (key === 'members.remove') return 'Remove'
      if (key === 'members.confirmRemove') return 'Are you sure?'
      if (key === 'members.errors.load') return 'Load error'
      if (key === 'members.errors.remove') return 'Remove error'
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

describe('MemberList', () => {
  let MemberList: any
  let api: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/components/MemberList')
    MemberList = mod.MemberList
    const apiMod = await import('@/lib/api-client')
    api = apiMod.api
  })

  it('shows loading state', () => {
    api.mockReturnValue(new Promise(() => {}))
    render(<MemberList collectionId={1} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    api.mockResolvedValue([])
    render(<MemberList collectionId={1} />)
    await waitFor(() => {
      expect(screen.getByText('No members')).toBeInTheDocument()
    })
  })

  it('renders members', async () => {
    api.mockResolvedValue([
      { id: 1, userId: 2, displayName: 'Alice', email: 'alice@test.com', avatarUrl: null, role: 'owner' },
      { id: 2, userId: 3, displayName: 'Bob', email: 'bob@test.com', avatarUrl: null, role: 'editor' },
    ])
    render(<MemberList collectionId={1} />)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('shows role badges', async () => {
    api.mockResolvedValue([
      { id: 1, userId: 2, displayName: 'Alice', email: 'a@test.com', avatarUrl: null, role: 'owner' },
    ])
    render(<MemberList collectionId={1} />)
    await waitFor(() => {
      expect(screen.getByText('owner')).toBeInTheDocument()
    })
  })
})
