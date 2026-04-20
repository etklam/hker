import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as boardService from '@/server/services/family-todo-board-service'
import * as todoService from '@/server/services/family-todo-service'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/family-todo/lists/[lid]/todos
  return Number(segments[4])
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const lid = extractListId(req)
  if (!lid || isNaN(lid)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  const spaceId = await todoService.getSpaceIdForList(lid)
  if (!spaceId) return apiError('NOT_FOUND', 'List not found')

  const access = await getSpaceAccess(user.id, spaceId)
  requireSpaceAtLeast(access, 'member')

  let body: {
    title?: string
    description?: string
    priority?: string
    dueDate?: string
    assignedTo?: number
  }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return apiError('INVALID_REQUEST', 'Title is required')
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent']
  if (body.priority && !validPriorities.includes(body.priority)) {
    return apiError('INVALID_REQUEST', 'Priority must be one of: low, medium, high, urgent')
  }

  try {
    const todo = await todoService.createTodo(lid, user.id, {
      title: body.title.trim(),
      description: body.description?.trim(),
      priority: body.priority,
      dueDate: body.dueDate,
      assignedTo: body.assignedTo,
    })

    return Response.json(await boardService.buildTodoResponse(todo), { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
