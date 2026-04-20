import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as inviteService from '@/server/services/invite-service'

function extractIds(req: NextRequest): { collectionId: number; inviteId: number } {
  const segments = req.nextUrl.pathname.split('/')
  // /api/me/collections/[id]/invites/[inviteId]
  return {
    collectionId: Number(segments[4]),
    inviteId: Number(segments[6]),
  }
}

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const { collectionId, inviteId } = extractIds(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')
  if (!inviteId || isNaN(inviteId)) return apiError('INVALID_REQUEST', 'Invalid invite ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'owner')

  await inviteService.remove(collectionId, inviteId)
  return new Response(null, { status: 204 })
})
