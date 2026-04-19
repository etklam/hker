import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as todoService from '@/server/services/family-todo-service'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/family-todo/lists/[lid]/todos/reorder
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const lid = extractListId(req)
  if (!lid || isNaN(lid)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  const spaceId = await todoService.getSpaceIdForList(lid)
  if (!spaceId) return apiError('NOT_FOUND', 'List not found')

  const access = await getSpaceAccess(user.id, spaceId)
  requireSpaceAtLeast(access, 'member')

  let body: { ids?: number[] }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return apiError('INVALID_REQUEST', 'ids array is required')
  }

  try {
    await todoService.reorderTodos(lid, body.ids)
    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
