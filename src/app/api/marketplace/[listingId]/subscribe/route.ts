import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as subscriptionService from '@/server/services/subscription-service'

function extractListingId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/marketplace/[listingId]/subscribe → segments = ['', 'api', 'marketplace', '{listingId}', 'subscribe']
  return Number(segments[3])
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const listingId = extractListingId(req)
  if (!listingId || isNaN(listingId)) return apiError('INVALID_REQUEST', 'Invalid listing ID')

  try {
    await subscriptionService.subscribe(user.id, listingId)
    return Response.json({ subscribed: true }, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const listingId = extractListingId(req)
  if (!listingId || isNaN(listingId)) return apiError('INVALID_REQUEST', 'Invalid listing ID')

  try {
    await subscriptionService.unsubscribe(user.id, listingId)
    return Response.json({ subscribed: false })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
