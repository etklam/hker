import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as collectionService from '@/server/services/collection-service'
import { parseBody } from '@/schemas/parse-body'
import { createCollectionSchema } from '@/schemas/collection'

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const items = await collectionService.listForUser(user.id)
  return Response.json(items)
})

export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { title, description, icon } = parseBody(body, createCollectionSchema)
    const collection = await collectionService.create(user.id, {
      title: title.trim(),
      description: description?.trim(),
      icon: icon?.trim(),
    })

    const dto = {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      icon: collection.icon,
      visibility: collection.visibility,
      sortOrder: collection.sortOrder,
      linkCount: 0,
      access: 'owner' as const,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    }

    return Response.json(dto, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
