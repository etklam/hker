import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as boardService from '@/server/services/space-board-service'
import * as todoService from '@/server/services/space-todo-service'
import { parseBody } from '@/schemas/parse-body'
import { createSpaceTodoSchema } from '@/schemas/space'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/spaces/lists/[lid]/todos
  return Number(segments[4])
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const lid = extractListId(req)
  if (!lid || isNaN(lid)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  const spaceId = await todoService.getSpaceIdForList(lid)
  if (!spaceId) return apiError('NOT_FOUND', 'List not found')

  const access = await getSpaceAccess(user.id, spaceId)
  requireSpaceAtLeast(access, 'member')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { title, description, priority, dueDate, assignedTo } = parseBody(body, createSpaceTodoSchema)
    const todo = await todoService.createTodo(lid, user.id, {
      title: title.trim(),
      description: description?.trim(),
      priority,
      dueDate,
      assignedTo,
    })

    return Response.json(await boardService.buildTodoResponse(todo), { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
