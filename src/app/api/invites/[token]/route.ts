import { NextRequest } from 'next/server'
import { withOptionalAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import * as inviteService from '@/server/services/invite-service'

function extractToken(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  // /api/invites/[token]
  return segments[3]
}

export const GET = withOptionalAuth(async (req: NextRequest) => {
  const token = extractToken(req)
  if (!token) return apiError('INVALID_REQUEST', 'Invalid token')

  const invite = await inviteService.getByToken(token)
  if (!invite) return apiError('NOT_FOUND', 'Invite not found')

  const isExpired = invite.expiresAt ? new Date() > invite.expiresAt : false
  const isExhausted = invite.maxUses !== null && invite.useCount >= invite.maxUses

  return Response.json({
    collection: {
      id: invite.collectionId,
      title: invite.collectionTitle,
      description: invite.collectionDescription,
      icon: invite.collectionIcon,
    },
    role: invite.role,
    maxUses: invite.maxUses,
    useCount: invite.useCount,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    isValid: !isExpired && !isExhausted,
  })
})
