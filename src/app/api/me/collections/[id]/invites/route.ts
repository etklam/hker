import { NextRequest } from 'next/server'
import { withAuth } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import { getCollectionAccess, requireAtLeast } from '@/server/services/permission-service'
import * as inviteService from '@/server/services/invite-service'
import { parseBody } from '@/schemas/parse-body'
import { createInviteSchema } from '@/schemas/invite'

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { role, maxUses, expiresInHours } = parseBody(body, createInviteSchema)
    const invite = await inviteService.create(collectionId, user.id, {
      role,
      maxUses,
      expiresInHours,
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
