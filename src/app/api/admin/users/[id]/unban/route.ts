import { NextRequest } from 'next/server'
import { withAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'

export const POST = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const targetUserId = parseInt(url.pathname.split('/').slice(-2)[0], 10)

  if (isNaN(targetUserId)) {
    return Response.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  const [updatedUser] = await db
    .update(users)
    .set({ banned: false, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning()

  if (!updatedUser) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  return Response.json({ user: updatedUser })
})
