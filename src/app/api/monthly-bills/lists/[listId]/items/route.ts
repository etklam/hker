import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'
import { parseBody } from '@/schemas/parse-body'
import { createItemSchema } from '@/schemas/monthly-bills'

function extractListId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const listId = extractListId(req)
  if (!listId || isNaN(listId)) return apiError('INVALID_REQUEST', 'Invalid list ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { name, dueDay, amountCents, note } = parseBody(body, createItemSchema)
    const item = await monthlyBillService.createItem(user.id, listId, {
      name: name.trim(),
      dueDay,
      amountCents: amountCents ?? null,
      note: note?.trim() || null,
    })
    return Response.json(item, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
