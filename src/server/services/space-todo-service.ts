import { eq, sql, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { spaceLists, spaceTodos } from '@/db/schema/space'
import { AppError } from '@/lib/errors'

export async function createList(spaceId: number, title: string) {
  const [maxRow] = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${spaceLists.sortOrder}), -1)` })
    .from(spaceLists)
    .where(eq(spaceLists.spaceId, spaceId))

  const nextSort = (maxRow?.maxSort ?? -1) + 1

  const [list] = await db
    .insert(spaceLists)
    .values({ spaceId, title, sortOrder: nextSort })
    .returning()

  return list
}

export async function updateList(spaceId: number, listId: number, data: { title?: string }) {
  if (data.title === undefined) return null

  const [updated] = await db
    .update(spaceLists)
    .set({ title: data.title })
    .where(and(eq(spaceLists.id, listId), eq(spaceLists.spaceId, spaceId)))
    .returning()

  return updated ?? null
}

export async function removeList(spaceId: number, listId: number) {
  const [row] = await db
    .delete(spaceLists)
    .where(and(eq(spaceLists.id, listId), eq(spaceLists.spaceId, spaceId)))
    .returning()
  return row ?? null
}

export async function reorderLists(spaceId: number, ids: number[]) {
  if (ids.length === 0) return

  await db.transaction(async (tx) => {
    const cases = ids.map((id, i) => sql`WHEN ${id} THEN ${i}`).reduce((a, b) => sql`${a} ${b}`)
    await tx
      .update(spaceLists)
      .set({
        sortOrder: sql`CASE ${spaceLists.id} ${cases} END`,
      })
      .where(and(
        eq(spaceLists.spaceId, spaceId),
        sql`${spaceLists.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
      ))
  })
}

export async function createTodo(
  listId: number,
  createdBy: number,
  data: {
    title: string
    description?: string
    priority?: string
    dueDate?: string
    assignedTo?: number
  },
) {
  const [maxRow] = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${spaceTodos.sortOrder}), -1)` })
    .from(spaceTodos)
    .where(eq(spaceTodos.listId, listId))

  const nextSort = (maxRow?.maxSort ?? -1) + 1

  const [todo] = await db
    .insert(spaceTodos)
    .values({
      listId,
      title: data.title,
      description: data.description ?? null,
      priority: (data.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedTo: data.assignedTo ?? null,
      createdBy,
      sortOrder: nextSort,
    })
    .returning()

  return todo
}

export async function updateTodo(
  todoId: number,
  data: {
    title?: string
    description?: string | null
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    dueDate?: string | null
    assignedTo?: number | null
  },
) {
  const values: {
    title?: string
    description?: string | null
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    dueDate?: Date | null
    assignedTo?: number | null
    updatedAt: Date
  } = { updatedAt: new Date() }
  if (data.title !== undefined) values.title = data.title
  if (data.description !== undefined) values.description = data.description
  if (data.priority !== undefined) values.priority = data.priority
  if (data.dueDate !== undefined) values.dueDate = data.dueDate ? new Date(data.dueDate) : null
  if (data.assignedTo !== undefined) values.assignedTo = data.assignedTo

  const [updated] = await db
    .update(spaceTodos)
    .set(values)
    .where(eq(spaceTodos.id, todoId))
    .returning()

  return updated ?? null
}

export async function removeTodo(todoId: number) {
  await db.delete(spaceTodos).where(eq(spaceTodos.id, todoId))
}

export async function toggleComplete(
  todoId: number,
  completed: boolean,
  completedByUserId: number,
) {
  const values: {
    completed: boolean
    completedAt: Date | null
    completedBy: number | null
    updatedAt: Date
  } = {
    completed,
    completedAt: completed ? new Date() : null,
    completedBy: completed ? completedByUserId : null,
    updatedAt: new Date(),
  }

  const [updated] = await db
    .update(spaceTodos)
    .set(values)
    .where(eq(spaceTodos.id, todoId))
    .returning()

  return updated ?? null
}

export async function moveTodo(todoId: number, targetListId: number) {
  const todo = await getTodoById(todoId)
  if (!todo) throw new AppError('NOT_FOUND', 'Todo not found')

  const targetList = await getListById(targetListId)
  if (!targetList) throw new AppError('NOT_FOUND', 'Target list not found')

  const sourceList = await getListById(todo.listId)
  if (!sourceList) throw new AppError('NOT_FOUND', 'Source list not found')

  if (sourceList.spaceId !== targetList.spaceId) {
    throw new AppError('INVALID_REQUEST', 'Cannot move todo to a list in a different space')
  }

  const [maxRow] = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${spaceTodos.sortOrder}), -1)` })
    .from(spaceTodos)
    .where(eq(spaceTodos.listId, targetListId))

  const nextSort = (maxRow?.maxSort ?? -1) + 1

  const [updated] = await db
    .update(spaceTodos)
    .set({ listId: targetListId, sortOrder: nextSort, updatedAt: new Date() })
    .where(eq(spaceTodos.id, todoId))
    .returning()

  return updated ?? null
}

export async function reorderTodos(listId: number, ids: number[]) {
  if (ids.length === 0) return

  await db.transaction(async (tx) => {
    const cases = ids.map((id, i) => sql`WHEN ${id} THEN ${i}`).reduce((a, b) => sql`${a} ${b}`)
    await tx
      .update(spaceTodos)
      .set({
        sortOrder: sql`CASE ${spaceTodos.id} ${cases} END`,
      })
      .where(and(
        eq(spaceTodos.listId, listId),
        sql`${spaceTodos.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
      ))
  })
}

export async function getTodoById(todoId: number) {
  const [todo] = await db
    .select()
    .from(spaceTodos)
    .where(eq(spaceTodos.id, todoId))
    .limit(1)
  return todo ?? null
}

export async function getListById(listId: number) {
  const [list] = await db
    .select()
    .from(spaceLists)
    .where(eq(spaceLists.id, listId))
    .limit(1)
  return list ?? null
}

export async function getSpaceIdForList(listId: number) {
  const list = await getListById(listId)
  if (!list) return null
  return list.spaceId
}

export async function getSpaceIdForTodo(todoId: number) {
  const [row] = await db
    .select({ spaceId: spaceLists.spaceId })
    .from(spaceTodos)
    .innerJoin(spaceLists, eq(spaceTodos.listId, spaceLists.id))
    .where(eq(spaceTodos.id, todoId))
    .limit(1)
  return row?.spaceId ?? null
}

export async function getListsForSpace(spaceId: number) {
  return db
    .select()
    .from(spaceLists)
    .where(eq(spaceLists.spaceId, spaceId))
    .orderBy(spaceLists.sortOrder)
}

export async function getTodosForSpace(spaceId: number) {
  return db
    .select({
      id: spaceTodos.id,
      listId: spaceTodos.listId,
      title: spaceTodos.title,
      description: spaceTodos.description,
      assignedTo: spaceTodos.assignedTo,
      priority: spaceTodos.priority,
      dueDate: spaceTodos.dueDate,
      completed: spaceTodos.completed,
      completedAt: spaceTodos.completedAt,
      completedBy: spaceTodos.completedBy,
      sortOrder: spaceTodos.sortOrder,
      createdBy: spaceTodos.createdBy,
      createdAt: spaceTodos.createdAt,
      updatedAt: spaceTodos.updatedAt,
    })
    .from(spaceTodos)
    .innerJoin(spaceLists, eq(spaceTodos.listId, spaceLists.id))
    .where(eq(spaceLists.spaceId, spaceId))
    .orderBy(spaceTodos.sortOrder)
}
