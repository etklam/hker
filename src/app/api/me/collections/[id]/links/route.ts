import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as linkService from '@/server/services/link-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'view')

  const items = await linkService.listForCollection(collectionId)
  return Response.json(items)
})

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'edit')

  let body: { title?: string; url?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return apiError('INVALID_REQUEST', 'Title is required')
  }
  if (!body.url || typeof body.url !== 'string') {
    return apiError('INVALID_REQUEST', 'URL is required')
  }

  try {
    const link = await linkService.create(collectionId, {
      title: body.title.trim(),
      url: body.url.trim(),
      description: body.description?.trim(),
    })
    return Response.json(link, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
