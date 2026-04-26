import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'

function parsePeriod(req: NextRequest): { year: number; month: number } | Response {
  const search = req.nextUrl.searchParams
  const now = new Date()
  const year = search.get('year') ? Number(search.get('year')) : now.getFullYear()
  const month = search.get('month') ? Number(search.get('month')) : now.getMonth() + 1

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return apiError('INVALID_REQUEST', 'Invalid year')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return apiError('INVALID_REQUEST', 'Invalid month')
  }

  return { year, month }
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const period = parsePeriod(req)
  if (period instanceof Response) return period

  const listIdParam = req.nextUrl.searchParams.get('listId')
  const listId = listIdParam ? Number(listIdParam) : undefined
  if (listIdParam && (!listId || isNaN(listId))) {
    return apiError('INVALID_REQUEST', 'Invalid list ID')
  }

  const board = await monthlyBillService.getBoard(user.id, {
    listId,
    year: period.year,
    month: period.month,
  })
  return Response.json(board)
})
