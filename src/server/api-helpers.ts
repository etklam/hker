import { NextRequest } from 'next/server'
import { resolveSession } from '@/server/auth'
import { apiError } from '@/lib/errors'
import type { AuthUser } from '@/lib/types'

// --- Rate limiting (in-memory sliding window) ---

interface RateLimitEntry {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL_MS = 60_000
let lastCleanup = Date.now()

function cleanupExpiredEntries(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  cleanupExpiredEntries(windowMs)

  let entry = rateLimitStore.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    const retryAfterMs = windowMs - (now - oldest)
    return { allowed: false, retryAfterMs }
  }

  entry.timestamps.push(now)
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

export function applyRateLimit(req: NextRequest): Response | null {
  const ip = getClientIp(req)
  const pathname = new URL(req.url).pathname
  const config = getRateLimitConfig(req.method, pathname)
  const key = `rl:${ip}:${req.method}:${pathname}`

  const { allowed, retryAfterMs } = rateLimit(key, config.limit, config.windowMs)
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

// --- Login failure tracking ---

interface LoginFailureEntry {
  count: number
  firstFailure: number
  lockedUntil: number | null
}

const loginFailureStore = new Map<string, LoginFailureEntry>()

const MAX_LOGIN_FAILURES = 5
const LOCKOUT_DURATION_MS = 15 * 60_000

export function isAccountLocked(email: string): boolean {
  const entry = loginFailureStore.get(email.toLowerCase())
  if (!entry || !entry.lockedUntil) return false
  if (Date.now() >= entry.lockedUntil) {
    loginFailureStore.delete(email.toLowerCase())
    return false
  }
  return true
}

export function trackLoginFailure(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  let entry = loginFailureStore.get(key)

  if (!entry) {
    entry = { count: 0, firstFailure: now, lockedUntil: null }
    loginFailureStore.set(key, entry)
  }

  entry.count++

  if (entry.count >= MAX_LOGIN_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS
  }
}

export function clearLoginFailures(email: string): void {
  loginFailureStore.delete(email.toLowerCase())
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

  if (!baseUrl) return true

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

    const rateLimitResponse = applyRateLimit(req)
    if (rateLimitResponse) return rateLimitResponse

    const user = await resolveSession(req)
    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required')
    }

    return handler(req, { user })
  }
}

export function withOptionalAuth(handler: OptionalAuthHandler) {
  return async (req: NextRequest) => {
    if (!validateOrigin(req)) {
      return apiError('FORBIDDEN', 'Invalid origin')
    }

    const rateLimitResponse = applyRateLimit(req)
    if (rateLimitResponse) return rateLimitResponse

    const user = await resolveSession(req)

    return handler(req, { user })
  }
}
