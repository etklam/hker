import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionCard } from '@/components/CollectionCard'
import type { Collection } from '@/lib/types'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (key === 'collections.linksCount') return `${opts?.count ?? 0} links`
      if (key === 'collections.shared') return 'Shared'
      if (key === 'common.edit') return 'Edit'
      if (key === 'common.delete') return 'Delete'
      return key
    },
  }),
}))

// Mock next/link - avoid JSX in hoisted factory
vi.mock('next/link', () => {
  const { createElement } = require('react')
  return { default: (props: any) => createElement('a', props, props.children) }
})

const baseCollection: Collection = {
  id: 1,
  title: 'My Collection',
  description: 'Test description',
  icon: null,
  visibility: 'private',
  sortOrder: 0,
  linkCount: 5,
  access: 'owner',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

describe('CollectionCard', () => {
  it('renders title and link count', () => {
    render(
      <CollectionCard
        collection={baseCollection}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('My Collection')).toBeInTheDocument()
    expect(screen.getByText('5 links')).toBeInTheDocument()
  })

  it('renders visibility badge', () => {
    render(
      <CollectionCard
        collection={{ ...baseCollection, visibility: 'public' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('public')).toBeInTheDocument()
  })

  it('renders shared badge for non-owner', () => {
    render(
      <CollectionCard
        collection={{ ...baseCollection, access: 'editor' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Shared')).toBeInTheDocument()
  })

  it('shows edit/delete buttons for owner', () => {
    render(
      <CollectionCard
        collection={baseCollection}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Edit')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete')).toBeInTheDocument()
  })

  it('hides edit/delete buttons for non-owner', () => {
    render(
      <CollectionCard
        collection={{ ...baseCollection, access: 'viewer' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', async () => {
    const onEdit = vi.fn()
    render(
      <CollectionCard
        collection={baseCollection}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByLabelText('Edit'))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('calls onDelete when delete button clicked', async () => {
    const onDelete = vi.fn()
    render(
      <CollectionCard
        collection={baseCollection}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByLabelText('Delete'))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
