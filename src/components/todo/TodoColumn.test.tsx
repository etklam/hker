import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoColumn } from '@/components/todo/TodoColumn'
import type { TodoListWithItems, TodoResponse } from '@/lib/types'

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: any) => children,
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: vi.fn(() => '') },
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'todo.addTodo': 'Add Todo',
        'todo.dragOrAdd': 'Drag or add todos',
        'todo.deleteListConfirm': 'Delete this list?',
        'todo.priority.low': 'Low',
        'todo.priority.medium': 'Medium',
        'todo.priority.high': 'High',
        'todo.priority.urgent': 'Urgent',
        'todo.createTodo': 'New Todo',
      }
      return map[key] ?? key
    },
  }),
}))

const mockTodo: TodoResponse = {
  id: 1,
  listId: 1,
  title: 'Test Todo',
  description: null,
  assignedTo: null,
  priority: 'medium',
  dueDate: null,
  completed: false,
  completedAt: null,
  completedBy: null,
  sortOrder: 0,
  createdBy: { id: 1, displayName: 'User', avatarUrl: null, email: 'u@test.com' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

const baseList: TodoListWithItems = {
  id: 1,
  spaceId: 1,
  title: 'My List',
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  todos: [mockTodo],
}

describe('TodoColumn', () => {
  it('renders list title and todo count', () => {
    render(
      <TodoColumn
        list={baseList}
        canManageLists={true}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.getByText('My List')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // todo count
  })

  it('renders todos', () => {
    render(
      <TodoColumn
        list={baseList}
        canManageLists={true}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.getByText('Test Todo')).toBeInTheDocument()
  })

  it('shows empty message when no todos', () => {
    render(
      <TodoColumn
        list={{ ...baseList, todos: [] }}
        canManageLists={true}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.getByText('Drag or add todos')).toBeInTheDocument()
  })

  it('shows add todo button', () => {
    render(
      <TodoColumn
        list={baseList}
        canManageLists={true}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.getByText('Add Todo')).toBeInTheDocument()
  })
})
