import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as marketplaceService from '@/server/services/marketplace-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/marketplace/unpublish/[collectionId] → segments = ['', 'api', 'marketplace', 'unpublish', '{collectionId}']
  return Number(segments[4])
}

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  try {
    requireAtLeast(access, 'owner')
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }

  try {
    await marketplaceService.unpublish(collectionId)
    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
