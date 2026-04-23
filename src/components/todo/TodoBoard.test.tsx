import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => children,
  DragOverlay: ({ children }: any) => children,
  closestCorners: {},
  PointerSensor: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => children,
  horizontalListSortingStrategy: {},
  arrayMove: (arr: any[], oldIdx: number, newIdx: number) => {
    const result = [...arr]
    const [removed] = result.splice(oldIdx, 1)
    result.splice(newIdx, 0, removed)
    return result
  },
}))

vi.mock('./TodoColumn', () => ({
  TodoColumn: ({ list }: any) => {
    const { createElement } = require('react')
    return createElement('div', { 'data-testid': `column-${list.id}` }, list.title)
  },
}))

vi.mock('./AddListButton', () => ({
  AddListButton: ({ onAdd }: any) => {
    const { createElement } = require('react')
    return createElement('button', { 'data-testid': 'add-list' }, 'Add List')
  },
}))

vi.mock('./TodoCard', () => ({
  TodoCard: ({ todo }: any) => {
    const { createElement } = require('react')
    return createElement('div', null, todo.title)
  },
}))

const mockLists = [
  { id: 1, spaceId: 1, title: 'To Do', sortOrder: 0, createdAt: '2025-01-01', todos: [
    { id: 1, listId: 1, title: 'Task 1', description: null, priority: 'medium', dueDate: null, completed: false, completedAt: null, completedBy: null, sortOrder: 0, createdBy: 1, createdAt: '2025-01-01', updatedAt: '2025-01-01', assignedTo: null },
  ]},
  { id: 2, spaceId: 1, title: 'Done', sortOrder: 1, createdAt: '2025-01-01', todos: [] },
]

describe('TodoBoard', () => {
  let TodoBoard: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/components/todo/TodoBoard')
    TodoBoard = mod.TodoBoard
  })

  it('renders columns for each list', () => {
    render(
      <TodoBoard
        lists={mockLists}
        canManageLists={true}
        onReorderLists={vi.fn()}
        onReorderTodos={vi.fn()}
        onMoveTodo={vi.fn()}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onAddList={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('column-1')).toBeInTheDocument()
    expect(screen.getByTestId('column-2')).toBeInTheDocument()
  })

  it('shows add list button when canManageLists', () => {
    render(
      <TodoBoard
        lists={mockLists}
        canManageLists={true}
        onReorderLists={vi.fn()}
        onReorderTodos={vi.fn()}
        onMoveTodo={vi.fn()}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onAddList={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('add-list')).toBeInTheDocument()
  })

  it('hides add list button when not canManageLists', () => {
    render(
      <TodoBoard
        lists={mockLists}
        canManageLists={false}
        onReorderLists={vi.fn()}
        onReorderTodos={vi.fn()}
        onMoveTodo={vi.fn()}
        onAddTodo={vi.fn()}
        onOpenCreate={vi.fn()}
        onAddList={vi.fn()}
        onEditTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteList={vi.fn()}
        onUpdateListTitle={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('add-list')).not.toBeInTheDocument()
  })
})
