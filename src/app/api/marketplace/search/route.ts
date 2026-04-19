import { NextRequest } from 'next/server'
import { withOptionalAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as marketplaceService from '@/server/services/marketplace-service'

export const GET = withOptionalAuth(async (req: NextRequest) => {
  const url = req.nextUrl
  const query = url.searchParams.get('q')?.trim()

  if (!query || query.length === 0) {
    return apiError('INVALID_REQUEST', 'Search query is required')
  }

  if (query.length > 200) {
    return apiError('INVALID_REQUEST', 'Search query too long')
  }

  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0'))
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '20')))

  try {
    const result = await marketplaceService.searchListings(query, page, size)
    return Response.json(result)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
