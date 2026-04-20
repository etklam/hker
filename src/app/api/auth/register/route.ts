import { NextRequest } from 'next/server'
import { apiError, AppError } from '@/lib/errors'
import { applyRateLimit } from '@/server/api-helpers'
import * as authService from '@/server/services/auth-service'
import * as sessionService from '@/server/services/session-service'
import { setSessionCookie } from '@/server/auth'
import type { SessionResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  let body: { email?: string; password?: string; displayName?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const { email, password, displayName } = body

  if (!email || typeof email !== 'string') {
    return apiError('INVALID_REQUEST', 'Email is required')
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return apiError('INVALID_REQUEST', 'Invalid email format')
  }

  if (!password || typeof password !== 'string') {
    return apiError('INVALID_REQUEST', 'Password is required')
  }

  if (password.length < 8 || password.length > 128) {
    return apiError('INVALID_REQUEST', 'Password must be between 8 and 128 characters')
  }

  try {
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
