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

export async function POST(req: NextRequest) {
  const rateLimitResponse = applyRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const { email, password } = body

  if (!email || typeof email !== 'string') {
    return apiError('INVALID_REQUEST', 'Email is required')
  }

  if (!password || typeof password !== 'string') {
    return apiError('INVALID_REQUEST', 'Password is required')
  }

  if (isAccountLocked(email)) {
    return apiError('FORBIDDEN', 'Account temporarily locked due to too many failed attempts')
  }

  try {
    const user = await authService.login(email, password)

    clearLoginFailures(email)

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
      },
    }

    const response = Response.json(responseBody)
    response.headers.append('Set-Cookie', cookie)
    return response
  } catch (err) {
    if (err instanceof AppError && err.code === 'INVALID_CREDENTIALS') {
      trackLoginFailure(email)
      return apiError('INVALID_CREDENTIALS', 'Invalid email or password')
    }
    throw err
  }
}
