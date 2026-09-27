import { withAuth } from '@/server/api-helpers'
import { clearSessionCookie, SESSION_COOKIE_NAME } from '@/server/auth'
import { destroySession } from '@/server/services/session-service'

export const POST = withAuth(async (req) => {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await destroySession(token)
  }

  const cookie = clearSessionCookie()
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie },
  })
})
