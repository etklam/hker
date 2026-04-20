import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as spaceService from '@/server/services/family-todo-space-service'

function extractIds(req: NextRequest): { sid: number; inviteId: number } {
  const segments = req.nextUrl.pathname.split('/')
  // /api/family-todo/spaces/[sid]/invites/[inviteId]
  return {
    sid: Number(segments[4]),
    inviteId: Number(segments[6]),
  }
}

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const { sid, inviteId } = extractIds(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')
  if (!inviteId || isNaN(inviteId)) return apiError('INVALID_REQUEST', 'Invalid invite ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  await spaceService.deleteInvite(sid, inviteId)
  return new Response(null, { status: 204 })
})
