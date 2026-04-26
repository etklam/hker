import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'

function extractItemId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const itemId = extractItemId(req)
  if (!itemId || isNaN(itemId)) return apiError('INVALID_REQUEST', 'Invalid item ID')

  let body: {
    name?: string
    dueDay?: number
    amountCents?: number | null
    note?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
    return apiError('INVALID_REQUEST', 'Name is required')
  }
  if (body.dueDay !== undefined && (!Number.isInteger(body.dueDay) || body.dueDay < 1 || body.dueDay > 31)) {
    return apiError('INVALID_REQUEST', 'Due day must be between 1 and 31')
  }
  if (
    body.amountCents !== undefined &&
    body.amountCents !== null &&
    (!Number.isInteger(body.amountCents) || body.amountCents < 0)
  ) {
    return apiError('INVALID_REQUEST', 'Invalid amount')
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return apiError('INVALID_REQUEST', 'Invalid note')
  }

  try {
    const item = await monthlyBillService.updateItem(user.id, itemId, {
      name: body.name?.trim(),
      dueDay: body.dueDay,
      amountCents: body.amountCents,
      note: body.note === undefined ? undefined : body.note?.trim() || null,
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
