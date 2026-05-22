import { NextRequest } from 'next/server'
import { withAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { collections } from '@/db/schema/collections'
import * as collectionService from '@/server/services/collection-service'
import { eq } from 'drizzle-orm'

export const DELETE = withAdmin(async (
  req: NextRequest,
  { user: _user }: { user: { id: number } },
) => {
  const url = new URL(req.url)
  const targetId = parseInt(url.pathname.split('/').slice(-1)[0], 10)

  if (isNaN(targetId)) {
    return Response.json({ error: 'Invalid collection ID' }, { status: 400 })
  }

  const existing = await collectionService.getById(targetId)
  if (!existing) {
    return Response.json({ error: 'Collection not found' }, { status: 404 })
  }

  await collectionService.remove(targetId)

  return new Response(null, { status: 204 })
})

export const PUT = withAdmin(async (
  req: NextRequest,
  { user: _user }: { user: { id: number } },
) => {
  const url = new URL(req.url)
  const targetId = parseInt(url.pathname.split('/').slice(-1)[0], 10)

  if (isNaN(targetId)) {
    return Response.json({ error: 'Invalid collection ID' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { title, description, icon } = body

  if (!title && description === undefined && icon === undefined) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  let existing = await collectionService.getById(targetId)
  if (!existing) {
    return Response.json({ error: 'Collection not found' }, { status: 404 })
  }

  const updated = await collectionService.update(targetId, {
    title,
    description: description !== undefined ? description : existing.description,
    icon: icon !== undefined ? icon : existing.icon,
  })

  if (!updated) {
    return Response.json({ error: 'Collection not found' }, { status: 404 })
  }

  return Response.json({ collection: updated })
})
