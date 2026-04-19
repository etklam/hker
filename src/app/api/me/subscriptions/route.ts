import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as subscriptionService from '@/server/services/subscription-service'

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  try {
    const items = await subscriptionService.listUserSubscriptions(user.id)
    return Response.json(items)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
