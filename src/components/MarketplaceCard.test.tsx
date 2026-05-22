import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketplaceCard } from '@/components/MarketplaceCard'
import type { MarketplaceListing } from '@/lib/types'

vi.mock('next/link', () => {
  const { createElement } = require('react')
  return { default: (props: any) => createElement('a', props, props.children) }
})

const baseListing: MarketplaceListing = {
  id: 1,
  title: 'Public Collection',
  description: 'A great collection',
  collection: {
    id: 1,
    title: 'Public Collection',
    description: 'A great collection',
    icon: null,
    visibility: 'public',
    sortOrder: 0,
    linkCount: 10,
    access: 'none',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  publisher: {
    id: 1,
    displayName: 'John Doe',
    avatarUrl: null,
  },
  publishedAt: '2025-01-01T00:00:00.000Z',
  subscriberCount: 42,
  forkCount: 7,
}

describe('MarketplaceCard', () => {
  it('renders collection title and description', () => {
    render(<MarketplaceCard listing={baseListing} />)
    expect(screen.getByText('Public Collection')).toBeInTheDocument()
    expect(screen.getByText('A great collection')).toBeInTheDocument()
  })

  it('renders publisher name', () => {
    render(<MarketplaceCard listing={baseListing} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows Anonymous when publisher is null', () => {
    render(
      <MarketplaceCard
        listing={{ ...baseListing, publisher: null }}
      />,
    )
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
  })

  it('renders subscriber and fork counts', () => {
    render(<MarketplaceCard listing={baseListing} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})
