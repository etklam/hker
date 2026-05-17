import * as todoService from '@/server/services/space-todo-service'
import * as spaceService from '@/server/services/space-service'
import { fetchUsersById } from '@/server/services/user-service'
import type { UserBrief, TodoResponse, TodoListWithItems, BoardResponse } from '@/lib/types'
import { getSpaceAccess } from '@/server/services/permission-service'
import { AppError } from '@/lib/errors'

type TodoRecord = NonNullable<Awaited<ReturnType<typeof todoService.getTodoById>>>
type UserRecord = {
  id: number
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

function toUserBrief(user: { id: number; displayName: string | null; avatarUrl: string | null; email: string | null }): UserBrief {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
  }
}

function toTodoResponse(todo: TodoRecord, usersMap: Map<number, UserRecord>): TodoResponse {
  const createdByUser = usersMap.get(todo.createdBy)
  const assignedToUser = todo.assignedTo ? usersMap.get(todo.assignedTo) : null
  const completedByUser = todo.completedBy ? usersMap.get(todo.completedBy) : null

  return {
    id: todo.id,
    listId: todo.listId,
    title: todo.title,
    description: todo.description,
    assignedTo: assignedToUser ? toUserBrief(assignedToUser) : null,
    priority: todo.priority,
    dueDate: todo.dueDate?.toISOString() ?? null,
    completed: todo.completed,
    completedAt: todo.completedAt?.toISOString() ?? null,
    completedBy: completedByUser ? toUserBrief(completedByUser) : null,
    sortOrder: todo.sortOrder,
    createdBy: createdByUser
      ? toUserBrief(createdByUser)
      : { id: todo.createdBy, displayName: null, avatarUrl: null, email: null },
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  }
}

export async function buildTodoResponse(todo: TodoRecord): Promise<TodoResponse> {
  const userIds = new Set<number>()
  if (todo.assignedTo) userIds.add(todo.assignedTo)
  if (todo.completedBy) userIds.add(todo.completedBy)
  userIds.add(todo.createdBy)

  const usersMap = await fetchUsersById([...userIds])
  return toTodoResponse(todo, usersMap)
}

export async function getBoardData(spaceId: number, userId: number): Promise<BoardResponse> {
  const space = await spaceService.getById(spaceId)
  if (!space) throw new AppError('NOT_FOUND', 'Space not found')

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
    const todoResponse = toTodoResponse(t, usersMap)
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
