import { NextRequest } from 'next/server'
import { apiError, AppError } from '@/lib/errors'
import { applyRateLimit } from '@/server/api-helpers'
import * as authService from '@/server/services/auth-service'
import * as sessionService from '@/server/services/session-service'
import { setSessionCookie } from '@/server/auth'
import type { SessionResponse } from '@/lib/types'
import { parseBody } from '@/schemas/parse-body'
import { registerSchema } from '@/schemas/auth'

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  try {
    const { email, password, displayName } = parseBody(body, registerSchema)
    const user = await authService.register(email, password, displayName)
    const token = await sessionService.createSession(user.id)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const cookie = setSessionCookie(token, expiresAt)

    const responseBody: SessionResponse = {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    }

    const response = Response.json(responseBody, { status: 201 })
    response.headers.append('Set-Cookie', cookie)
    return response
  } catch (err) {
    if (err instanceof AppError) {
      return apiError(err.code, err.message)
    }
    if (err instanceof Error && err.message.includes('unique')) {
      return apiError('CONFLICT', 'An account with this email already exists')
    }
    throw err
  }
}
