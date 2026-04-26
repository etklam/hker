import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'

export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: { name?: string; sharedSpaceId?: number | null }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return apiError('INVALID_REQUEST', 'Name is required')
  }
  if (
    body.sharedSpaceId !== undefined &&
    body.sharedSpaceId !== null &&
    (!Number.isInteger(body.sharedSpaceId) || body.sharedSpaceId <= 0)
  ) {
    return apiError('INVALID_REQUEST', 'Invalid shared space ID')
  }

  try {
    const list = await monthlyBillService.createList(user.id, {
      name: body.name.trim(),
      sharedSpaceId: body.sharedSpaceId,
    })
    return Response.json(list, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
