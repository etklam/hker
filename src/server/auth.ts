import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import type { AuthUser } from '@/lib/types'
import { validateSession } from '@/server/services/session-service'

const COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? '__Host-hker_session'

export async function getServerUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const result = await validateSession(token)
  if (!result) return null

  return {
    id: result.user.id,
    email: result.user.email,
    displayName: result.user.displayName,
    avatarUrl: result.user.avatarUrl,
    role: result.user.role,
  }
}

function isSecure(): boolean {
  const baseUrl = process.env.APP_BASE_URL ?? ''
  if (baseUrl) return baseUrl.startsWith('https')
  return process.env.NODE_ENV === 'production'
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
    role: result.user.role,
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
