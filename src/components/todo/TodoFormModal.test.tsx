import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoFormModal } from '@/components/todo/TodoFormModal'
import type { TodoResponse } from '@/lib/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'todo.editTodo': 'Edit Todo',
        'todo.createTodo': 'New Todo',
        'todo.labels.title': 'Title',
        'todo.labels.description': 'Description',
        'todo.labels.priority': 'Priority',
        'todo.labels.dueDate': 'Due Date',
        'todo.labels.assignTo': 'Assign to',
        'todo.labels.save': 'Save',
        'todo.labels.cancel': 'Cancel',
        'todo.labels.delete': 'Delete',
        'todo.delete_confirm': 'Delete this todo?',
        'todo.priority.low': 'Low',
        'todo.priority.medium': 'Medium',
        'todo.priority.high': 'High',
        'todo.priority.urgent': 'Urgent',
      }
      return map[key] ?? key
    },
  }),
}))

describe('TodoFormModal', () => {
  it('renders create mode by default', () => {
    render(
      <TodoFormModal
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    expect(screen.getByText('New Todo')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders edit mode with pre-filled data', () => {
    const todo: TodoResponse = {
      id: 1,
      listId: 1,
      title: 'Existing Todo',
      description: 'Existing desc',
      assignedTo: null,
      priority: 'high',
      dueDate: null,
      completed: false,
      completedAt: null,
      completedBy: null,
      sortOrder: 0,
      createdBy: { id: 1, displayName: 'User', avatarUrl: null, email: 'u@test.com' },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
    render(
      <TodoFormModal
        todo={todo}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Edit Todo')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing Todo')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', async () => {
    const onClose = vi.fn()
    render(
      <TodoFormModal
        onClose={onClose}
        onSave={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onSave with form data when submitted', async () => {
    const onSave = vi.fn()
    render(
      <TodoFormModal
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    const titleInput = screen.getByLabelText('Title')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'New Todo Item')

    // Submit form
    await userEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Todo Item' }),
    )
  })

  it('does not submit with empty title', async () => {
    const onSave = vi.fn()
    render(
      <TodoFormModal
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    // Title is empty by default (or has autoFocus)
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).not.toHaveBeenCalled()
  })
})
