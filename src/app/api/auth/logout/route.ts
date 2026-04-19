import { NextRequest } from 'next/server'
import { clearSessionCookie } from '@/server/auth'
import { destroySession } from '@/server/services/session-service'

const COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? 'hker_session'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (token) {
    await destroySession(token)
  }

  const cookie = clearSessionCookie()
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie },
  })
}
