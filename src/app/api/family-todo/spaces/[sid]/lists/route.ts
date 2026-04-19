import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as todoService from '@/server/services/family-todo-service'

function extractSpaceId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const sid = extractSpaceId(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  let body: { title?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return apiError('INVALID_REQUEST', 'Title is required')
  }

  try {
    const list = await todoService.createList(sid, body.title.trim())
    return Response.json({
      id: list.id,
      spaceId: list.spaceId,
      title: list.title,
      sortOrder: list.sortOrder,
      createdAt: list.createdAt.toISOString(),
    }, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
