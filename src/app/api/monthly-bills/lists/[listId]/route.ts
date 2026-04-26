import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const listId = extractListId(req)
  if (!listId || isNaN(listId)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  let body: { name?: string; sharedSpaceId?: number | null }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
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
    const updated = await monthlyBillService.updateList(user.id, listId, {
      name: body.name?.trim(),
      sharedSpaceId: body.sharedSpaceId,
    })
    return Response.json(updated)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const listId = extractListId(req)
  if (!listId || isNaN(listId)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  try {
    await monthlyBillService.removeList(user.id, listId)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
