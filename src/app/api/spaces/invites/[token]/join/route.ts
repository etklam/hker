import { NextRequest } from 'next/server'
import { withAuth, rateLimit, getClientIp } from '@/server/api-helpers'
import { apiError, AppError } from '@/lib/errors'
import * as spaceService from '@/server/services/space-service'

function extractToken(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  // /api/family-todo/invites/[token]/join
  return segments[4]
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const ip = getClientIp(req)
  const { allowed, retryAfterMs } = await rateLimit(`family-todo-invite-join:${ip}`, 30, 60_000)
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
    const result = await spaceService.joinSpace(token, user.id)

    return Response.json({
      space: {
        id: result.space.id,
        name: result.space.name,
        ownerId: result.space.ownerId,
      },
      role: result.role,
    })
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message)
    throw e
  }
})
