import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as spaceService from '@/server/services/family-todo-space-service'
import { parseBody } from '@/schemas/parse-body'
import { createSpaceSchema } from '@/schemas/family-todo'

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const spaces = await spaceService.listForUser(user.id)
  return Response.json(spaces)
})

export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { name } = parseBody(body, createSpaceSchema)
    const space = await spaceService.create(user.id, name.trim())
    return Response.json(space, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
