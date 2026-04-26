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

  let body: { year?: number; month?: number; checked?: boolean }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const year = body.year
  const month = body.month

  if (!Number.isInteger(year) || year! < 2000 || year! > 2100) {
    return apiError('INVALID_REQUEST', 'Invalid year')
  }
  if (!Number.isInteger(month) || month! < 1 || month! > 12) {
    return apiError('INVALID_REQUEST', 'Invalid month')
  }
  if (typeof body.checked !== 'boolean') {
    return apiError('INVALID_REQUEST', 'checked must be a boolean')
  }

  try {
    await monthlyBillService.setItemChecked(user.id, itemId, {
      year: year!,
      month: month!,
    }, body.checked)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
