import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as linkService from '@/server/services/link-service'

function extractIds(req: NextRequest): { collectionId: number; linkId: number } {
  const segments = req.nextUrl.pathname.split('/')
  // /api/me/collections/[id]/links/[linkId]
  return {
    collectionId: Number(segments[4]),
    linkId: Number(segments[6]),
  }
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const { collectionId, linkId } = extractIds(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')
  if (!linkId || isNaN(linkId)) return apiError('INVALID_REQUEST', 'Invalid link ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'edit')

  let body: { title?: string; url?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const updated = await linkService.update(collectionId, linkId, {
      title: body.title?.trim(),
      url: body.url?.trim(),
      description: body.description?.trim(),
    })
    if (!updated) return apiError('NOT_FOUND', 'Link not found')
    return Response.json(updated)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const { collectionId, linkId } = extractIds(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')
  if (!linkId || isNaN(linkId)) return apiError('INVALID_REQUEST', 'Invalid link ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'edit')

  await linkService.remove(collectionId, linkId)
  return new Response(null, { status: 204 })
})
