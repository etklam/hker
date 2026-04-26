import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

function parseItemBody(body: {
  name?: string
  dueDay?: number
  amountCents?: number | null
  note?: string | null
}): Response | null {
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return apiError('INVALID_REQUEST', 'Name is required')
  }
  const dueDay = body.dueDay
  if (!Number.isInteger(dueDay) || dueDay! < 1 || dueDay! > 31) {
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
  return null
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const listId = extractListId(req)
  if (!listId || isNaN(listId)) return apiError('INVALID_REQUEST', 'Invalid list ID')

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

  const validation = parseItemBody(body)
  if (validation) return validation

  try {
    const item = await monthlyBillService.createItem(user.id, listId, {
      name: body.name!.trim(),
      dueDay: body.dueDay!,
      amountCents: body.amountCents ?? null,
      note: body.note?.trim() || null,
    })
    return Response.json(item, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
