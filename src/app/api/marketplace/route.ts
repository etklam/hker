import { NextRequest } from 'next/server'
import { withOptionalAuth } from '@/server/api-helpers'
import { AppError } from '@/lib/errors'
import { apiError } from '@/lib/errors'
import * as marketplaceService from '@/server/services/marketplace-service'

export const GET = withOptionalAuth(async (req: NextRequest) => {
  const url = req.nextUrl
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0'))
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '20')))
  const sortParam = url.searchParams.get('sort') ?? 'newest'
  const sort = sortParam === 'most_subscribed' ? 'most_subscribed' : 'newest'

  try {
    const result = await marketplaceService.listListings(page, size, sort)
    return Response.json(result)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
