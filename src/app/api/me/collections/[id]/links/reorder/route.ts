import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as linkService from '@/server/services/link-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'edit')

  let body: { ids?: number[] }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'number')) {
    return apiError('INVALID_REQUEST', 'ids must be an array of numbers')
  }

  try {
    await linkService.reorder(collectionId, body.ids)
    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
