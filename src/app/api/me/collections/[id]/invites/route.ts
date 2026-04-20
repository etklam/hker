import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as inviteService from '@/server/services/invite-service'

function extractCollectionId(req: NextRequest): number {
  const segments = req.nextUrl.pathname.split('/')
  return Number(segments[4])
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'owner')

  const invites = await inviteService.listForCollection(collectionId)
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
  const enriched = invites.map((inv) => ({
    ...inv,
    expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    url: `${baseUrl}/invite/${inv.token}`,
  }))
  return Response.json(enriched)
})

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const collectionId = extractCollectionId(req)
  if (!collectionId || isNaN(collectionId)) return apiError('INVALID_REQUEST', 'Invalid collection ID')

  const access = await getCollectionAccess(user.id, collectionId)
  requireAtLeast(access, 'owner')

  let body: { role?: string; maxUses?: number; expiresInHours?: number }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const validRoles = ['viewer', 'editor'] as const
  if (!body.role || !validRoles.includes(body.role as typeof validRoles[number])) {
    return apiError('INVALID_REQUEST', 'Role must be one of: viewer, editor')
  }

  if (body.maxUses !== undefined && (typeof body.maxUses !== 'number' || body.maxUses < 1)) {
    return apiError('INVALID_REQUEST', 'maxUses must be a positive number')
  }

  if (body.expiresInHours !== undefined && (typeof body.expiresInHours !== 'number' || body.expiresInHours < 1)) {
    return apiError('INVALID_REQUEST', 'expiresInHours must be a positive number')
  }

  try {
    const invite = await inviteService.create(collectionId, user.id, {
      role: body.role as 'viewer' | 'editor',
      maxUses: body.maxUses,
      expiresInHours: body.expiresInHours,
    })
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
    return Response.json({
      ...invite,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      createdAt: invite.createdAt.toISOString(),
      url: `${baseUrl}/invite/${invite.token}`,
    }, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
