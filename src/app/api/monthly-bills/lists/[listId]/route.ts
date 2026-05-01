import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'
import { parseBody } from '@/schemas/parse-body'
import { updateListSchema } from '@/schemas/monthly-bills'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const listId = extractListId(req)
  if (!listId || isNaN(listId)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { name, sharedSpaceId } = parseBody(body, updateListSchema)
    const updated = await monthlyBillService.updateList(user.id, listId, {
      name: name?.trim(),
      sharedSpaceId,
    })
    return Response.json(updated)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const listId = extractListId(req)
  if (!listId || isNaN(listId)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  try {
    await monthlyBillService.removeList(user.id, listId)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
