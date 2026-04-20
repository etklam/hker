import { withAuth } from '@/server/api-helpers'
import { clearSessionCookie } from '@/server/auth'
import { destroySession } from '@/server/services/session-service'

const COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? 'hker_session'

export const POST = withAuth(async (req) => {
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (token) {
    await destroySession(token)
  }

  const cookie = clearSessionCookie()
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie },
  })
})
