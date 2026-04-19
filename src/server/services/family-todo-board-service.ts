import * as todoService from '@/server/services/family-todo-service'
import * as spaceService from '@/server/services/family-todo-space-service'
import { fetchUsersById } from '@/server/services/user-service'
import type { UserBrief, TodoResponse, TodoListWithItems, BoardResponse } from '@/lib/types'
import { getSpaceAccess } from '@/server/services/permission-service'

function toUserBrief(user: { id: number; displayName: string | null; avatarUrl: string | null; email: string | null }): UserBrief {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
  }
}

export async function getBoardData(spaceId: number, userId: number): Promise<BoardResponse> {
  const space = await spaceService.getById(spaceId)
  if (!space) throw new Error('Space not found')

  const lists = await todoService.getListsForSpace(spaceId)
  const todos = await todoService.getTodosForSpace(spaceId)

  const userIds = new Set<number>()
  for (const t of todos) {
    if (t.assignedTo) userIds.add(t.assignedTo)
    if (t.completedBy) userIds.add(t.completedBy)
    userIds.add(t.createdBy)
  }

  const usersMap = await fetchUsersById([...userIds])

  const access = await getSpaceAccess(userId, spaceId)

  const todosByList = new Map<number, TodoResponse[]>()
  for (const t of todos) {
    const createdByUser = usersMap.get(t.createdBy)
    const assignedToUser = t.assignedTo ? usersMap.get(t.assignedTo) : null
    const completedByUser = t.completedBy ? usersMap.get(t.completedBy) : null

    const todoResponse: TodoResponse = {
      id: t.id,
      listId: t.listId,
      title: t.title,
      description: t.description,
      assignedTo: assignedToUser ? toUserBrief(assignedToUser) : null,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      completed: t.completed,
      completedAt: t.completedAt?.toISOString() ?? null,
      completedBy: completedByUser ? toUserBrief(completedByUser) : null,
      sortOrder: t.sortOrder,
      createdBy: createdByUser ? toUserBrief(createdByUser) : { id: t.createdBy, displayName: null, avatarUrl: null, email: null },
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }

    const arr = todosByList.get(t.listId) ?? []
    arr.push(todoResponse)
    todosByList.set(t.listId, arr)
  }

  const listsWithItems: TodoListWithItems[] = lists.map((l) => ({
    id: l.id,
    spaceId: l.spaceId,
    title: l.title,
    sortOrder: l.sortOrder,
    createdAt: l.createdAt.toISOString(),
    todos: todosByList.get(l.id) ?? [],
  }))

  return {
    space: {
      id: space.id,
      name: space.name,
      ownerId: space.ownerId,
      role: access,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    },
    lists: listsWithItems,
  }
}
