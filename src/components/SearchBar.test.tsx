import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '@/components/SearchBar'

describe('SearchBar', () => {
  it('renders input with value and placeholder', () => {
    render(
      <SearchBar
        value="hello"
        placeholder="Search..."
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    const input = screen.getByPlaceholderText('Search...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('hello')
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    render(
      <SearchBar
        value=""
        placeholder="Search"
        onChange={onChange}
        onSearch={vi.fn()}
      />,
    )
    await userEvent.type(screen.getByPlaceholderText('Search'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('calls onSearch when pressing Enter', async () => {
    const onSearch = vi.fn()
    render(
      <SearchBar
        value="test"
        placeholder="Search"
        onChange={vi.fn()}
        onSearch={onSearch}
      />,
    )
    await userEvent.type(screen.getByPlaceholderText('Search'), '{Enter}')
    expect(onSearch).toHaveBeenCalledOnce()
  })

  it('calls onSearch when clicking button', async () => {
    const onSearch = vi.fn()
    render(
      <SearchBar
        value="test"
        placeholder="Search"
        onChange={vi.fn()}
        onSearch={onSearch}
      />,
    )
    // The button is the one next to the input
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[buttons.length - 1]) // search button
    expect(onSearch).toHaveBeenCalledOnce()
  })
})
