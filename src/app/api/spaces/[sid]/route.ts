import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as spaceService from '@/server/services/space-service'
import { parseBody } from '@/schemas/parse-body'
import { updateSpaceSchema } from '@/schemas/space'

function extractSpaceId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[3])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const sid = extractSpaceId(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { name } = parseBody(body, updateSpaceSchema)
    const updated = await spaceService.update(sid, { name: name?.trim() })
    if (!updated) return apiError('NOT_FOUND', 'Space not found')
    return Response.json({
      id: updated.id,
      name: updated.name,
      ownerId: updated.ownerId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const sid = extractSpaceId(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  await spaceService.remove(sid)
  return new Response(null, { status: 204 })
})
