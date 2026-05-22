import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess } from '@/server/services/permission-service'
import { db } from '@/server/db'
import { marketplaceListings } from '@/db/schema/marketplace'
import { eq } from 'drizzle-orm'
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

  // Owner and editors can always unpublish
  if (access === 'owner' || access === 'edit') {
    try {
      await marketplaceService.unpublish(collectionId)
      return Response.json({ success: true })
    } catch (e) {
      if (e instanceof AppError) return apiError(e.code, e.message)
      throw e
    }
  }

  // Fallback: check if user is the original publisher (handles demotion edge case)
  const [listing] = await db
    .select({ publisherId: marketplaceListings.publisherId })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.collectionId, collectionId))
    .limit(1)

  if (listing && listing.publisherId === user.id) {
    try {
      await marketplaceService.unpublish(collectionId)
      return Response.json({ success: true })
    } catch (e) {
      if (e instanceof AppError) return apiError(e.code, e.message)
      throw e
    }
  }

  return apiError('FORBIDDEN', 'Insufficient collection access')
})
