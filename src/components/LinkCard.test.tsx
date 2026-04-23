import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkCard } from '@/components/LinkCard'
import type { Link } from '@/lib/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const baseLink: Link = {
  id: 1,
  collectionId: 1,
  title: 'Test Link',
  url: 'https://example.com',
  description: 'A link description',
  faviconUrl: null,
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

describe('LinkCard', () => {
  it('renders title, URL, and description', () => {
    render(<LinkCard link={baseLink} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Test Link')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('A link description')).toBeInTheDocument()
  })

  it('renders action buttons when not readOnly', () => {
    render(<LinkCard link={baseLink} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByLabelText('common.edit')).toBeInTheDocument()
    expect(screen.getByLabelText('common.delete')).toBeInTheDocument()
  })

  it('hides action buttons when readOnly', () => {
    render(<LinkCard link={baseLink} onEdit={vi.fn()} onDelete={vi.fn()} readOnly />)
    expect(screen.queryByLabelText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('common.delete')).not.toBeInTheDocument()
  })

  it('calls onEdit when edit clicked', async () => {
    const onEdit = vi.fn()
    render(<LinkCard link={baseLink} onEdit={onEdit} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('common.edit'))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('calls onDelete when delete clicked', async () => {
    const onDelete = vi.fn()
    render(<LinkCard link={baseLink} onEdit={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByLabelText('common.delete'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('renders without description when null', () => {
    render(
      <LinkCard
        link={{ ...baseLink, description: null }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Test Link')).toBeInTheDocument()
  })
})
