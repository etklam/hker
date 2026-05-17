import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as todoService from '@/server/services/space-todo-service'
import { parseBody } from '@/schemas/parse-body'
import { updateSpaceListSchema } from '@/schemas/space'

function extractIds(req: NextRequest): { sid: number; lid: number } {
  const segments = req.nextUrl.pathname.split('/')
  return { sid: Number(segments[3]), lid: Number(segments[5]) }
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const { sid, lid } = extractIds(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')
  if (!lid || isNaN(lid)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { title } = parseBody(body, updateSpaceListSchema)
    const updated = await todoService.updateList(sid, lid, { title: title?.trim() })
    if (!updated) return apiError('NOT_FOUND', 'List not found')
    return Response.json({
      id: updated.id,
      spaceId: updated.spaceId,
      title: updated.title,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const { sid, lid } = extractIds(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')
  if (!lid || isNaN(lid)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  await todoService.removeList(sid, lid)
  return new Response(null, { status: 204 })
})
