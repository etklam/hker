import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as spaceService from '@/server/services/family-todo-space-service'

function extractIds(req: NextRequest): { sid: number; mid: number } {
  const segments = req.nextUrl.pathname.split('/')
  return { sid: Number(segments[4]), mid: Number(segments[6]) }
}

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const { sid, mid } = extractIds(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')
  if (!mid || isNaN(mid)) return apiError('INVALID_REQUEST', 'Invalid member ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  await spaceService.removeMember(mid)
  return new Response(null, { status: 204 })
})
