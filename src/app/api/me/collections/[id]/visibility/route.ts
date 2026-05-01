import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as collectionService from '@/server/services/collection-service'
import { parseBody } from '@/schemas/parse-body'
import { updateVisibilitySchema } from '@/schemas/collection'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const id = extractCollectionId(req)
  if (!id || isNaN(id)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, id)
  requireAtLeast(access, 'owner')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { visibility } = parseBody(body, updateVisibilitySchema)
    const updated = await collectionService.updateVisibility(id, visibility)
    if (!updated) return apiError('NOT_FOUND', 'Collection not found')
    return Response.json(updated)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
