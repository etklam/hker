import type { NextRequest } from 'next/server'
import type { AuthUser } from '@/lib/types'
import { validateSession } from '@/server/services/session-service'

const COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? 'hker_session'

function isSecure(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  const baseUrl = process.env.APP_BASE_URL ?? ''
  return baseUrl.startsWith('https')
}

export async function resolveSession(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  const result = await validateSession(token)
  if (!result) return null

  return {
    id: result.user.id,
    email: result.user.email,
    displayName: result.user.displayName,
    avatarUrl: result.user.avatarUrl,
  }
}

export function setSessionCookie(token: string, expiresAt: Date): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
  ]
  if (isSecure()) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

export function clearSessionCookie(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
  ]
  if (isSecure()) {
    parts.push('Secure')
  }
  return parts.join('; ')
}
