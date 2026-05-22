import { randomBytes, createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { authSessions } from '@/db/schema/auth'
import * as userService from '@/server/services/user-service'

const SESSION_TTL_DAYS = parseInt(process.env.AUTH_SESSION_TTL_DAYS ?? '30', 10)
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET
if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SESSION_SECRET environment variable is required in production')
  }
  console.warn('⚠ AUTH_SESSION_SECRET not set — using insecure default for development')
}
const SESSION_HMAC_KEY = SESSION_SECRET ?? 'dev-only-insecure-secret'

export function hashSessionToken(token: string): string {
  return createHmac('sha256', SESSION_HMAC_KEY).update(token).digest('hex')
}

export async function createSession(userId: number): Promise<string> {
  const rawToken = randomBytes(48).toString('base64url')
  const tokenHash = hashSessionToken(rawToken)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS)

  await db.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt,
  })

  return rawToken
}

export async function validateSession(token: string) {
  const tokenHash = hashSessionToken(token)

  const [session] = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, tokenHash))
    .limit(1)

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await db.delete(authSessions).where(eq(authSessions.id, session.id))
    return null
  }

  // Throttle lastSeenAt writes to reduce DB load
  const SEEN_THROTTLE_MS = 5 * 60 * 1000
  if (!session.lastSeenAt || session.lastSeenAt.getTime() < Date.now() - SEEN_THROTTLE_MS) {
    await db
      .update(authSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(authSessions.id, session.id))
  }

  const user = await userService.findById(session.userId)
  if (!user) return null

  // Block banned users from authenticating
  if (user.banned) return null

  return { session, user }
}

export async function destroySession(token: string) {
  const tokenHash = hashSessionToken(token)
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash))
}
