import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as memberService from '@/server/services/member-service'
import { parseBody } from '@/schemas/parse-body'
import { updateMemberRoleSchema } from '@/schemas/member'

function extractIds(req: NextRequest): { collectionId: number; memberId: number } {
  const segments = req.nextUrl.pathname.split('/')
  // /api/me/collections/[id]/members/[memberId]
  return {
    collectionId: Number(segments[4]),
    memberId: Number(segments[6]),
  }
}

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const { collectionId, memberId } = extractIds(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')
  if (!memberId || isNaN(memberId)) return apiError('INVALID_REQUEST', 'Invalid member ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'owner')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { role } = parseBody(body, updateMemberRoleSchema)
    const updated = await memberService.updateRole(collectionId, memberId, role)
    if (!updated) return apiError('NOT_FOUND', 'Member not found')
    return Response.json(updated)
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  const { collectionId, memberId } = extractIds(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')
  if (!memberId || isNaN(memberId)) return apiError('INVALID_REQUEST', 'Invalid member ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'owner')

  await memberService.remove(collectionId, memberId)
  return new Response(null, { status: 204 })
})
