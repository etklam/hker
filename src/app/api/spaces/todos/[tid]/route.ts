import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as boardService from '@/server/services/space-board-service'
import * as todoService from '@/server/services/space-todo-service'
import { parseBody } from '@/schemas/parse-body'
import { updateSpaceTodoSchema } from '@/schemas/space'

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { title, description, priority, dueDate, assignedTo } = parseBody(body, updateSpaceTodoSchema)
    const updated = await todoService.updateTodo(tid, {
      title: title?.trim(),
      description,
      priority,
      dueDate,
      assignedTo,
    })
    if (!updated) return apiError('NOT_FOUND', 'Todo not found')

    return Response.json(await boardService.buildTodoResponse(updated))
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
