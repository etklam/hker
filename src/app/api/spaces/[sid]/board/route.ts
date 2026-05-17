import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as boardService from '@/server/services/space-board-service'

function extractSpaceId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[3])
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const sid = extractSpaceId(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'member')

  const board = await boardService.getBoardData(sid, user.id)
  return Response.json(board)
})
