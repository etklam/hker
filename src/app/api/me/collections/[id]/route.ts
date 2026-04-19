import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as collectionService from '@/server/services/collection-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/me/collections/[id] → segments = ['', 'api', 'me', 'collections', '{id}', ...]
  const id = Number(segments[4])
  return id
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const id = extractCollectionId(req)
  if (!id || isNaN(id)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, id)
  requireAtLeast(access, 'view')

  const collection = await collectionService.getById(id)
  if (!collection) return apiError('NOT_FOUND', 'Collection not found')

  return Response.json(collection)
})

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const id = extractCollectionId(req)
  if (!id || isNaN(id)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, id)
  requireAtLeast(access, 'owner')

  let body: { title?: string; description?: string; icon?: string; sortOrder?: number }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const updated = await collectionService.update(id, {
      title: body.title?.trim(),
      description: body.description?.trim(),
      icon: body.icon?.trim(),
      sortOrder: body.sortOrder,
    })
    if (!updated) return apiError('NOT_FOUND', 'Collection not found')
    return Response.json(updated)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const id = extractCollectionId(req)
  if (!id || isNaN(id)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, id)
  requireAtLeast(access, 'owner')

  await collectionService.remove(id)
  return new Response(null, { status: 204 })
})
