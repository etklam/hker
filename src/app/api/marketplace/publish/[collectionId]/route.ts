import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as marketplaceService from '@/server/services/marketplace-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/marketplace/publish/[collectionId] → segments = ['', 'api', 'marketplace', 'publish', '{collectionId}']
  return Number(segments[4])
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  try {
    requireAtLeast(access, 'owner')
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }

  const anonymous = req.nextUrl.searchParams.get('anonymous') === 'true'

  try {
    const listing = await marketplaceService.publish(collectionId, user.id, anonymous)
    return Response.json(listing, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
