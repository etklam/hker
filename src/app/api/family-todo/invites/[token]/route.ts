import { NextRequest } from 'next/server'
import { withOptionalAuth, rateLimit, getClientIp } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'
import * as spaceService from '@/server/services/family-todo-space-service'

function extractToken(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  // /api/family-todo/invites/[token]
  return segments[4]
}

export const GET = withOptionalAuth(async (req: NextRequest) => {
  const ip = getClientIp(req)
  const { allowed, retryAfterMs } = await rateLimit(`family-todo-invite-info:${ip}`, 60, 60_000)
  if (!allowed) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
    return new Response(
      JSON.stringify({ code: 'RATE_LIMITED', message: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSeconds),
        },
      },
    )
  }

  const token = extractToken(req)
  if (!token) return apiError('INVALID_REQUEST', 'Invalid token')

  const invite = await spaceService.getInviteByToken(token)
  if (!invite) return apiError('NOT_FOUND', 'Invite not found')

  const isExpired = invite.expiresAt ? new Date() > invite.expiresAt : false
  const isExhausted = invite.maxUses !== null && invite.useCount >= invite.maxUses

  return Response.json({
    space: {
      id: invite.spaceId,
      name: invite.spaceName,
      ownerId: invite.spaceOwnerId,
    },
    maxUses: invite.maxUses,
    useCount: invite.useCount,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    isValid: !isExpired && !isExhausted,
  })
})
