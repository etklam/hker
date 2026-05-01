import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as collectionService from '@/server/services/collection-service'
import * as linkService from '@/server/services/link-service'
import { parseBody } from '@/schemas/parse-body'
import { updateCollectionSchema } from '@/schemas/collection'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  // /api/me/collections/[id] → segments = ['', 'api', 'me', 'collections', '{id}', ...]
  const id = Number(segments[4])
  return id
}

async function toCollectionDto(
  collection: NonNullable<Awaited<ReturnType<typeof collectionService.getById>>>,
  access: 'owner' | 'edit' | 'view' | 'none',
) {
  const linksRows = await linkService.listForCollection(collection.id)

  const accessLabel =
    access === 'owner' ? 'owner'
    : access === 'edit' ? 'editor'
    : access === 'view' ? 'viewer'
    : 'none'

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    icon: collection.icon,
    visibility: collection.visibility,
    sortOrder: collection.sortOrder,
    linkCount: linksRows.length,
    access: accessLabel,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  }
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const id = extractCollectionId(req)
  if (!id || isNaN(id)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, id)
  requireAtLeast(access, 'view')

  const collection = await collectionService.getById(id)
  if (!collection) return apiError('NOT_FOUND', 'Collection not found')

  return Response.json(await toCollectionDto(collection, access))
})

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
    const { title, description, icon, sortOrder } = parseBody(body, updateCollectionSchema)
    const updated = await collectionService.update(id, {
      title: title?.trim(),
      description: description?.trim(),
      icon: icon?.trim(),
      sortOrder,
    })
    if (!updated) return apiError('NOT_FOUND', 'Collection not found')
    return Response.json(await toCollectionDto(updated, 'owner'))
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
