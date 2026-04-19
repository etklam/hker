import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as todoService from '@/server/services/family-todo-service'

function extractTodoId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/family-todo/todos/[tid]
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const tid = extractTodoId(req)
  if (!tid || isNaN(tid)) return apiError('INVALID_REQUEST', 'Invalid todo ID')

  const spaceId = await todoService.getSpaceIdForTodo(tid)
  if (!spaceId) return apiError('NOT_FOUND', 'Todo not found')

  const access = await getSpaceAccess(user.id, spaceId)
  requireSpaceAtLeast(access, 'member')

  let body: {
    title?: string
    description?: string | null
    priority?: string
    dueDate?: string | null
    assignedTo?: number | null
  }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent']
  if (body.priority && !validPriorities.includes(body.priority)) {
    return apiError('INVALID_REQUEST', 'Priority must be one of: low, medium, high, urgent')
  }

  try {
    const updated = await todoService.updateTodo(tid, {
      title: body.title?.trim(),
      description: body.description,
      priority: body.priority,
      dueDate: body.dueDate,
      assignedTo: body.assignedTo,
    })
    if (!updated) return apiError('NOT_FOUND', 'Todo not found')

    return Response.json({
      id: updated.id,
      listId: updated.listId,
      title: updated.title,
      description: updated.description,
      assignedTo: updated.assignedTo,
      priority: updated.priority,
      dueDate: updated.dueDate?.toISOString() ?? null,
      completed: updated.completed,
      completedAt: updated.completedAt?.toISOString() ?? null,
      completedBy: updated.completedBy,
      sortOrder: updated.sortOrder,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const tid = extractTodoId(req)
  if (!tid || isNaN(tid)) return apiError('INVALID_REQUEST', 'Invalid todo ID')

  const spaceId = await todoService.getSpaceIdForTodo(tid)
  if (!spaceId) return apiError('NOT_FOUND', 'Todo not found')

  const access = await getSpaceAccess(user.id, spaceId)
  requireSpaceAtLeast(access, 'member')

  await todoService.removeTodo(tid)
  return new Response(null, { status: 204 })
})
