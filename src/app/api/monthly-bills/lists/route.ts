import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as monthlyBillService from '@/server/services/monthly-bill-service'
import { parseBody } from '@/schemas/parse-body'
import { createListSchema } from '@/schemas/monthly-bills'

export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { name, sharedSpaceId } = parseBody(body, createListSchema)
    const list = await monthlyBillService.createList(user.id, {
      name: name.trim(),
      sharedSpaceId,
    })
    return Response.json(list, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
