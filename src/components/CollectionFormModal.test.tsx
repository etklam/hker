import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock api-client and toast before importing the component
vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({
  pushToast: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'collections.form.createTitle': 'New Collection',
        'collections.form.editTitle': 'Edit Collection',
        'collections.form.fields.title': 'Title',
        'collections.form.fields.description': 'Description',
        'collections.form.fields.icon': 'Icon',
        'collections.form.iconHint': 'Use an emoji',
        'common.cancel': 'Cancel',
        'common.create': 'Create',
        'common.update': 'Update',
        'common.saving': 'Saving...',
        'collections.errors.requiredTitle': 'Title is required',
        'collections.errors.save': 'Failed to save',
      }
      return map[key] ?? key
    },
  }),
}))

describe('CollectionFormModal', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Need to reimport for fresh module state
    vi.resetModules()
  })

  it('renders create mode', async () => {
    const { CollectionFormModal } = await import('@/components/CollectionFormModal')
    render(
      <CollectionFormModal
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )
    expect(screen.getByText('New Collection')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
  })

  it('renders edit mode with pre-filled title', async () => {
    const { CollectionFormModal } = await import('@/components/CollectionFormModal')
    const { default: mockCollection } = await import('@/lib/types').then(() => ({
      default: null,
    }))

    const collection = {
      id: 1,
      title: 'Existing',
      description: 'Desc',
      icon: '📚',
      visibility: 'private' as const,
      sortOrder: 0,
      linkCount: 3,
      access: 'owner' as const,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    render(
      <CollectionFormModal
        collection={collection}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )
    expect(screen.getByText('Edit Collection')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', async () => {
    const { CollectionFormModal } = await import('@/components/CollectionFormModal')
    const onClose = vi.fn()
    render(<CollectionFormModal onClose={onClose} onSuccess={vi.fn()} />)

    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('validates title is required', async () => {
    const { pushToast } = await import('@/lib/toast')
    const { CollectionFormModal } = await import('@/components/CollectionFormModal')
    render(<CollectionFormModal onClose={vi.fn()} onSuccess={vi.fn()} />)

    // Clear the title field if needed and submit
    const titleInput = screen.getByLabelText('Title')
    await userEvent.clear(titleInput)
    await userEvent.click(screen.getByText('Create'))

    expect(pushToast).toHaveBeenCalledWith('Title is required', 'error')
  })
})
