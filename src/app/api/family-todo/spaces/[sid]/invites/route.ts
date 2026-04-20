import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from '@/server/services/permission-service'
import * as spaceService from '@/server/services/family-todo-space-service'

function extractSpaceId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const sid = extractSpaceId(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  const invites = await spaceService.listInvites(sid)
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
  const enriched = invites.map((inv) => ({
    ...inv,
    expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    url: `${baseUrl}/family-todo/invite/${inv.token}`,
  }))
  return Response.json(enriched)
})

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const sid = extractSpaceId(req)
  if (!sid || isNaN(sid)) return apiError('INVALID_REQUEST', 'Invalid space ID')

  const access = await getSpaceAccess(user.id, sid)
  requireSpaceAtLeast(access, 'admin')

  let body: { maxUses?: number; expiresInHours?: number }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  if (body.maxUses !== undefined && (typeof body.maxUses !== 'number' || body.maxUses < 1)) {
    return apiError('INVALID_REQUEST', 'maxUses must be a positive number')
  }

  if (body.expiresInHours !== undefined && (typeof body.expiresInHours !== 'number' || body.expiresInHours < 1)) {
    return apiError('INVALID_REQUEST', 'expiresInHours must be a positive number')
  }

  try {
    const invite = await spaceService.createInvite(sid, user.id, {
      maxUses: body.maxUses,
      expiresInHours: body.expiresInHours,
    })
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
    return Response.json({
      ...invite,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      createdAt: invite.createdAt.toISOString(),
      url: `${baseUrl}/family-todo/invite/${invite.token}`,
    }, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
