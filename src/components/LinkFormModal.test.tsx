import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'links.create') return 'Create Link'
      if (key === 'links.edit') return 'Edit Link'
      if (key === 'links.fields.title') return 'Title'
      if (key === 'links.fields.url') return 'URL'
      if (key === 'links.fields.description') return 'Description'
      if (key === 'common.cancel') return 'Cancel'
      if (key === 'common.create') return 'Create'
      if (key === 'common.update') return 'Update'
      if (key === 'common.saving') return 'Saving...'
      if (key === 'links.errors.required') return 'Title and URL required'
      if (key === 'links.errors.save') return 'Save error'
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

describe('LinkFormModal', () => {
  let LinkFormModal: any
  let api: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/components/LinkFormModal')
    LinkFormModal = mod.LinkFormModal
    const apiMod = await import('@/lib/api-client')
    api = apiMod.api
  })

  it('renders create modal', () => {
    render(<LinkFormModal collectionId={1} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByText('Create Link')).toBeInTheDocument()
  })

  it('renders edit modal with pre-filled values', () => {
    const link = { id: 5, title: 'Example', url: 'https://example.com', description: 'A link', faviconUrl: null, sortOrder: 0, collectionId: 1, createdAt: '2025-01-01', updatedAt: '2025-01-01' }
    render(<LinkFormModal collectionId={1} link={link} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByText('Edit Link')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Example')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
  })

  it('calls onClose when clicking backdrop', async () => {
    const onClose = vi.fn()
    render(<LinkFormModal collectionId={1} onClose={onClose} onSuccess={vi.fn()} />)
    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking cancel button', async () => {
    const onClose = vi.fn()
    render(<LinkFormModal collectionId={1} onClose={onClose} onSuccess={vi.fn()} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls api on submit with valid data', async () => {
    api.mockResolvedValue({ id: 1, title: 'Test', url: 'https://test.com', description: '', faviconUrl: null, sortOrder: 0, collectionId: 1, createdAt: '2025-01-01', updatedAt: '2025-01-01' })
    const onSuccess = vi.fn()
    render(<LinkFormModal collectionId={1} onClose={vi.fn()} onSuccess={onSuccess} />)

    await userEvent.type(screen.getByPlaceholderText('https://'), 'https://test.com')
    const titleInput = screen.getAllByRole('textbox')[0]
    await userEvent.type(titleInput, 'Test')
    await userEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(api).toHaveBeenCalled()
    })
  })
})
