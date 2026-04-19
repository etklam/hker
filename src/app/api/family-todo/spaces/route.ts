import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as spaceService from '@/server/services/family-todo-space-service'

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const spaces = await spaceService.listForUser(user.id)
  return Response.json(spaces)
})

export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return apiError('INVALID_REQUEST', 'Name is required')
  }

  try {
    const space = await spaceService.create(user.id, body.name.trim())
    return Response.json(space, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
