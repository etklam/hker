import { NextRequest } from 'next/server'
import { withOptionalAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as marketplaceService from '@/server/services/marketplace-service'

function extractListingId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/marketplace/[listingId] → segments = ['', 'api', 'marketplace', '{listingId}', ...]
  return Number(segments[3])
}

export const GET = withOptionalAuth(async (req: NextRequest) => {
  const listingId = extractListingId(req)
  if (!listingId || isNaN(listingId)) return apiError('INVALID_REQUEST', 'Invalid listing ID')

  try {
    const detail = await marketplaceService.getDetail(listingId)
    return Response.json(detail)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
