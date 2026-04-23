import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { AppError } from '@/lib/errors'

describe('family-todo-service', () => {
  let ts: typeof import('@/server/services/family-todo-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    ts = await import('@/server/services/family-todo-service')
  })

  describe('createList', () => {
    it('creates list with auto-incremented sortOrder', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ maxSort: 3 }]),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1, spaceId: 1, title: 'New List', sortOrder: 4, createdAt: new Date(),
          }]),
        }),
      } as any)

      const result = await ts.createList(1, 'New List')
      expect(result.sortOrder).toBe(4)
    })
  })

  describe('updateList', () => {
    it('returns null when no fields to update', async () => {
      const result = await ts.updateList(1, 1, {})
      expect(result).toBeNull()
    })

    it('returns updated list', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Updated' }]),
          }),
        }),
      } as any)

      const result = await ts.updateList(1, 1, { title: 'Updated' })
      expect(result).toEqual({ id: 1, title: 'Updated' })
    })
  })

  describe('removeList', () => {
    it('returns deleted list', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any)

      const result = await ts.removeList(1, 1)
      expect(result).toEqual({ id: 1 })
    })

    it('returns null when not found', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await ts.removeList(1, 999)
      expect(result).toBeNull()
    })
  })

  describe('reorderLists', () => {
    it('does nothing for empty array', async () => {
      await ts.reorderLists(1, [])
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('calls transaction', async () => {
      const tx = { update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }) }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))
      await ts.reorderLists(1, [2, 1, 3])
      expect(tx.update).toHaveBeenCalled()
    })
  })

  describe('createTodo', () => {
    it('creates with auto-incremented sortOrder', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ maxSort: 2 }]),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1, listId: 1, title: 'Todo', sortOrder: 3, priority: 'medium',
          }]),
        }),
      } as any)

      const result = await ts.createTodo(1, 1, { title: 'Todo' })
      expect(result.sortOrder).toBe(3)
    })
  })

  describe('updateTodo', () => {
    it('returns updated todo', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Updated' }]),
          }),
        }),
      } as any)

      const result = await ts.updateTodo(1, { title: 'Updated' })
      expect(result).toEqual({ id: 1, title: 'Updated' })
    })
  })

  describe('toggleComplete', () => {
    it('sets completed=true', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, completed: true }]),
          }),
        }),
      } as any)

      const result = await ts.toggleComplete(1, true, 1)
      expect(result.completed).toBe(true)
    })

    it('sets completed=false', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, completed: false }]),
          }),
        }),
      } as any)

      const result = await ts.toggleComplete(1, false, 1)
      expect(result.completed).toBe(false)
    })
  })

  describe('moveTodo', () => {
    it('throws NOT_FOUND for non-existent todo', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      await expect(ts.moveTodo(999, 1)).rejects.toThrow('Todo not found')
    })

    it('throws for cross-space move', async () => {
      // moveTodo calls: getTodoById(todoId), getListById(targetListId), getListById(todo.listId)
      let call = 0
      vi.mocked(db.select).mockImplementation(() => {
        call++
        const results: any[] = [
          [{ id: 1, listId: 1 }],           // getTodoById: todo in list 1
          [{ id: 2, spaceId: 2 }],           // getListById(target): target list in space 2
          [{ id: 1, spaceId: 1 }],           // getListById(source): source list in space 1
        ]
        const result = results[call - 1] ?? []
        const limitFn = () => Promise.resolve(result)
        const whereFn = () => ({ limit: limitFn })
        const fromFn = () => ({ where: whereFn })
        return { from: fromFn } as any
      })

      await expect(ts.moveTodo(1, 2)).rejects.toThrow('Cannot move todo to a list in a different space')
    })
  })

  describe('getTodoById', () => {
    it('returns todo', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, title: 'Test' }]),
          }),
        }),
      } as any)

      expect(await ts.getTodoById(1)).toEqual({ id: 1, title: 'Test' })
    })

    it('returns null', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      expect(await ts.getTodoById(999)).toBeNull()
    })
  })

  describe('getSpaceIdForList', () => {
    it('returns spaceId', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ spaceId: 5 }]),
          }),
        }),
      } as any)

      expect(await ts.getSpaceIdForList(1)).toBe(5)
    })
  })

  describe('getSpaceIdForTodo', () => {
    it('returns spaceId via join', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ spaceId: 3 }]),
            }),
          }),
        }),
      } as any)

      expect(await ts.getSpaceIdForTodo(1)).toBe(3)
    })
  })
})
