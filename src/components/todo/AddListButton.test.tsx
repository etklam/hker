import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'todo.addList') return 'Add List'
      if (key === 'todo.editListTitle') return 'List title'
      return key
    },
  }),
}))

vi.mock('lucide-react', () => ({
  Plus: () => null,
  X: () => null,
}))

describe('AddListButton', () => {
  let AddListButton: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/components/todo/AddListButton')
    AddListButton = mod.AddListButton
  })

  it('renders add button', () => {
    render(<AddListButton onAdd={vi.fn()} />)
    expect(screen.getByText('Add List')).toBeInTheDocument()
  })

  it('opens form on click', async () => {
    render(<AddListButton onAdd={vi.fn()} />)
    await userEvent.click(screen.getByText('Add List'))
    expect(screen.getByPlaceholderText('List title')).toBeInTheDocument()
  })

  it('calls onAdd with title on submit', async () => {
    const onAdd = vi.fn()
    render(<AddListButton onAdd={onAdd} />)
    await userEvent.click(screen.getByText('Add List'))
    const input = screen.getByPlaceholderText('List title')
    await userEvent.type(input, 'Groceries')
    await userEvent.click(screen.getAllByText('Add List').find((el) => el.closest('button')?.disabled === false)!)
    expect(onAdd).toHaveBeenCalledWith('Groceries')
  })
})
