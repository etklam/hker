import { NextRequest } from 'next/server'
import { apiError, AppError } from '@/lib/errors'
import {
  applyRateLimit,
  isAccountLocked,
  trackLoginFailure,
  clearLoginFailures,
} from '@/server/api-helpers'
import * as authService from '@/server/services/auth-service'
import * as sessionService from '@/server/services/session-service'
import { setSessionCookie } from '@/server/auth'
import type { SessionResponse } from '@/lib/types'
import { parseBody } from '@/schemas/parse-body'
import { loginSchema } from '@/schemas/auth'

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  let email = ''
  try {
    const parsed = parseBody(body, loginSchema)
    email = parsed.email

    if (await isAccountLocked(parsed.email)) {
      return apiError('FORBIDDEN', 'Account temporarily locked due to too many failed attempts')
    }

    const user = await authService.login(parsed.email, parsed.password)

    await clearLoginFailures(parsed.email)

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

    const response = Response.json(responseBody)
    response.headers.append('Set-Cookie', cookie)
    return response
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === 'INVALID_CREDENTIALS') {
        await trackLoginFailure(email)
      }
      return apiError(err.code, err.message)
    }
    throw err
  }
}
