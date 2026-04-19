import { NextRequest } from 'next/server'
import { withOptionalAuth } from '@/server/api-helpers'
import type { SessionResponse } from '@/lib/types'

export const GET = withOptionalAuth(async (_req: NextRequest, { user }) => {
  const body: SessionResponse = user
    ? { authenticated: true, user }
    : { authenticated: false, user: null }

  return Response.json(body)
})
