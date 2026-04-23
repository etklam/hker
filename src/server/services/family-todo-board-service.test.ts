import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

vi.mock('@/server/services/family-todo-space-service', () => ({
  getById: vi.fn(),
}))
vi.mock('@/server/services/family-todo-service', () => ({
  getListsForSpace: vi.fn(),
  getTodosForSpace: vi.fn(),
}))
vi.mock('@/server/services/user-service', () => ({
  fetchUsersById: vi.fn(),
}))
vi.mock('@/server/services/permission-service', () => ({
  getSpaceAccess: vi.fn(),
}))

describe('family-todo-board-service', () => {
  let boardService: typeof import('@/server/services/family-todo-board-service')
  let spaceService: typeof import('@/server/services/family-todo-space-service')
  let todoService: typeof import('@/server/services/family-todo-service')
  let userService: typeof import('@/server/services/user-service')
  let permService: typeof import('@/server/services/permission-service')

  const mockSpace = { id: 1, name: 'Family Space', ownerId: 1, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') }
  const mockList = { id: 1, spaceId: 1, title: 'List', sortOrder: 0, createdAt: new Date('2025-01-01') }
  const mockTodo = {
    id: 1, listId: 1, title: 'Todo', description: null, assignedTo: null,
    priority: 'medium' as const, dueDate: null, completed: false, completedAt: null,
    completedBy: null, sortOrder: 0, createdBy: 1, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    boardService = await import('@/server/services/family-todo-board-service')
    spaceService = await import('@/server/services/family-todo-space-service')
    todoService = await import('@/server/services/family-todo-service')
    userService = await import('@/server/services/user-service')
    permService = await import('@/server/services/permission-service')
  })

  describe('buildTodoResponse', () => {
    it('enriches todo with user data', async () => {
      vi.mocked(userService.fetchUsersById).mockResolvedValue(new Map([
        [1, { id: 1, displayName: 'User 1', avatarUrl: null, email: 'u1@test.com' }],
      ]) as any)

      const result = await boardService.buildTodoResponse(mockTodo as any)
      expect(result.id).toBe(1)
      expect(result.createdBy.displayName).toBe('User 1')
    })
  })

  describe('getBoardData', () => {
    it('returns full board', async () => {
      vi.mocked(spaceService.getById).mockResolvedValue(mockSpace as any)
      vi.mocked(todoService.getListsForSpace).mockResolvedValue([mockList] as any)
      vi.mocked(todoService.getTodosForSpace).mockResolvedValue([mockTodo] as any)
      vi.mocked(userService.fetchUsersById).mockResolvedValue(new Map([
        [1, { id: 1, displayName: 'User 1', avatarUrl: null, email: 'u1@test.com' }],
      ]) as any)
      vi.mocked(permService.getSpaceAccess).mockResolvedValue('owner' as any)

      const result = await boardService.getBoardData(1, 1)
      expect(result.space.name).toBe('Family Space')
      expect(result.space.role).toBe('owner')
      expect(result.lists).toHaveLength(1)
    })

    it('throws NOT_FOUND for missing space', async () => {
      vi.mocked(spaceService.getById).mockResolvedValue(null as any)
      await expect(boardService.getBoardData(999, 1)).rejects.toThrow('Space not found')
    })
  })
})
