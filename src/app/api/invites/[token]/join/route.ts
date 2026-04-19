import { NextRequest } from 'next/server'
import { withAuth, rateLimit, getClientIp } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as inviteService from '@/server/services/invite-service'

function extractToken(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  // /api/invites/[token]/join
  return segments[3]
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const ip = getClientIp(req)
  const { allowed, retryAfterMs } = rateLimit(`invite-join:${ip}`, 30, 60_000)
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

  try {
    const result = await inviteService.joinCollection(token, user.id)

    return Response.json({
      collection: {
        id: result.collection.id,
        title: result.collection.title,
        description: result.collection.description,
        icon: result.collection.icon,
        visibility: result.collection.visibility,
      },
      role: result.role,
    })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
