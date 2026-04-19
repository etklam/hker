import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as memberService from '@/server/services/member-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'view')

  const members = await memberService.listForCollection(collectionId)
  return Response.json(members)
})
