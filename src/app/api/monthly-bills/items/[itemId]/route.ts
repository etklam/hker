import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'
import { parseBody } from '@/schemas/parse-body'
import { updateItemSchema } from '@/schemas/monthly-bills'

function extractItemId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const itemId = extractItemId(req)
  if (!itemId || isNaN(itemId)) return apiError('INVALID_REQUEST', 'Invalid item ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { name, dueDay, amountCents, note } = parseBody(body, updateItemSchema)
    const item = await monthlyBillService.updateItem(user.id, itemId, {
      name: name?.trim(),
      dueDay,
      amountCents,
      note: note === undefined ? undefined : note?.trim() || null,
    })
    return Response.json(item)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const itemId = extractItemId(req)
  if (!itemId || isNaN(itemId)) return apiError('INVALID_REQUEST', 'Invalid item ID')

  try {
    await monthlyBillService.removeItem(user.id, itemId)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
