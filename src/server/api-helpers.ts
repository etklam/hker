import { NextRequest } from 'next/server'
import { resolveSession } from '@/server/auth'
import { apiError, AppError } from '@/lib/errors'
import type { AuthUser } from '@/lib/types'
import { db } from '@/server/db'
import { rateLimitEntries, loginFailures } from '@/db/schema/rateLimit'
import { eq, sql, and, lt, gte } from 'drizzle-orm'
import { isAdmin } from '@/server/services/permission-service'

// --- Rate limiting (DB-backed sliding window) ---

export function rateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterMs: number }> {
  return rateLimitCheck(key, limit, windowMs)
}

async function rateLimitCheck(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const windowStart = new Date(Date.now() - windowMs)

  // Cleanup old entries periodically (1% of requests)
  if (Math.random() < 0.01) {
    await db.delete(rateLimitEntries).where(lt(rateLimitEntries.hitAt, windowStart)).catch(() => {})
  }

  const [{ hitCount }] = await db
    .select({ hitCount: sql<number>`count(*)::int` })
    .from(rateLimitEntries)
    .where(and(
      eq(rateLimitEntries.key, key),
      gte(rateLimitEntries.hitAt, windowStart),
    ))

  if (hitCount >= limit) {
    // Find oldest hit in window to compute retry-after
    const [oldest] = await db
      .select({ hitAt: rateLimitEntries.hitAt })
      .from(rateLimitEntries)
      .where(and(
        eq(rateLimitEntries.key, key),
        gte(rateLimitEntries.hitAt, windowStart),
      ))
      .orderBy(rateLimitEntries.hitAt)
      .limit(1)

    const retryAfterMs = oldest
      ? windowMs - (Date.now() - oldest.hitAt.getTime())
      : windowMs

    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) }
  }

  await db.insert(rateLimitEntries).values({ key })
  return { allowed: true, retryAfterMs: 0 }
}

// --- Rate limit config per endpoint ---

interface RateLimitConfig {
  limit: number
  windowMs: number
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'POST:/api/auth/login': { limit: 20, windowMs: 60_000 },
  'POST:/api/auth/register': { limit: 10, windowMs: 60_000 },
  'GET:/api/marketplace/search': { limit: 60, windowMs: 60_000 },
  'GET:/api/marketplace': { limit: 90, windowMs: 60_000 },
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = { limit: 120, windowMs: 60_000 }

export function getRateLimitConfig(method: string, pathname: string): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[`${method}:${pathname}`] ?? DEFAULT_RATE_LIMIT
}

export async function applyRateLimit(req: NextRequest): Promise<Response | null> {
  const ip = getClientIp(req)
  const pathname = new URL(req.url).pathname
  const config = getRateLimitConfig(req.method, pathname)
  const key = `rl:${ip}:${req.method}:${pathname}`

  const { allowed, retryAfterMs } = await rateLimit(key, config.limit, config.windowMs)
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
  return null
}

// --- Login failure tracking (DB-backed) ---

const MAX_LOGIN_FAILURES = 5
const LOCKOUT_DURATION_MS = 15 * 60_000

export async function isAccountLocked(email: string): Promise<boolean> {
  const key = email.toLowerCase()
  const [entry] = await db
    .select()
    .from(loginFailures)
    .where(eq(loginFailures.email, key))
    .limit(1)

  if (!entry || !entry.lockedUntil) return false

  if (new Date() >= entry.lockedUntil) {
    await db.delete(loginFailures).where(eq(loginFailures.email, key))
    return false
  }
  return true
}

export async function trackLoginFailure(email: string): Promise<void> {
  const key = email.toLowerCase()
  const now = new Date()

  const [existing] = await db
    .select()
    .from(loginFailures)
    .where(eq(loginFailures.email, key))
    .limit(1)

  if (!existing) {
    const lockedUntil = 1 >= MAX_LOGIN_FAILURES ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null
    await db.insert(loginFailures).values({
      email: key,
      failCount: 1,
      firstFailure: now,
      lockedUntil,
    })
    return
  }

  const newCount = existing.failCount + 1
  const lockedUntil = newCount >= MAX_LOGIN_FAILURES
    ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
    : null

  await db
    .update(loginFailures)
    .set({ failCount: newCount, lockedUntil })
    .where(eq(loginFailures.email, key))
}

export async function clearLoginFailures(email: string): Promise<void> {
  await db.delete(loginFailures).where(eq(loginFailures.email, email.toLowerCase()))
}

// --- Trusted proxy / IP parsing ---

const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
)

export function getClientIp(req: NextRequest): string {
  const directIp = req.headers.get('x-real-ip') ?? '127.0.0.1'

  if (TRUSTED_PROXIES.has(directIp)) {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
      const first = forwarded.split(',')[0].trim()
      if (first) return first
    }
  }

  return directIp
}

// --- Origin / Referer CSRF validation ---

function validateOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true
  }

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const baseUrl = process.env.APP_BASE_URL

  if (!baseUrl) {
    if (process.env.NODE_ENV === 'production') return false
    return true
  }

  const allowedHost = new URL(baseUrl).host

  if (origin) {
    try {
      return new URL(origin).host === allowedHost
    } catch {
      return false
    }
  }

  if (referer) {
    try {
      return new URL(referer).host === allowedHost
    } catch {
      return false
    }
  }

  return false
}

// --- Auth wrappers ---

type AuthenticatedHandler = (
  req: NextRequest,
  context: { user: AuthUser },
) => Promise<Response>

type OptionalAuthHandler = (
  req: NextRequest,
  context: { user: AuthUser | null },
) => Promise<Response>

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest) => {
    if (!validateOrigin(req)) {
      return apiError('FORBIDDEN', 'Invalid origin')
    }

    const rateLimitResponse = await applyRateLimit(req)
    if (rateLimitResponse) return rateLimitResponse

    const user = await resolveSession(req)
    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required')
    }

    try {
      return await handler(req, { user })
    } catch (e) {
      if (e instanceof AppError) return apiError(e.code, e.message)
      throw e
    }
  }
}

export function withOptionalAuth(handler: OptionalAuthHandler) {
  return async (req: NextRequest) => {
    if (!validateOrigin(req)) {
      return apiError('FORBIDDEN', 'Invalid origin')
    }

    const rateLimitResponse = await applyRateLimit(req)
    if (rateLimitResponse) return rateLimitResponse

    const user = await resolveSession(req)

    try {
      return await handler(req, { user })
    } catch (e) {
      if (e instanceof AppError) return apiError(e.code, e.message)
      throw e
    }
  }
}

export function withAdmin(handler: AuthenticatedHandler) {
  return withAuth(async (req, ctx) => {
    if (!isAdmin(ctx.user.role)) {
      return apiError('FORBIDDEN', 'Admin access required')
    }
    return handler(req, ctx)
  })
}

export function withSuperAdmin(handler: AuthenticatedHandler) {
  return withAuth(async (req, ctx) => {
    if (ctx.user.role !== 'superadmin') {
      return apiError('FORBIDDEN', 'Superadmin access required')
    }
    return handler(req, ctx)
  })
}
