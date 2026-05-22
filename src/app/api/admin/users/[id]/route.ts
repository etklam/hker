import { NextRequest } from 'next/server'
import { withSuperAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'

export const DELETE = withSuperAdmin(async (
  req: NextRequest,
  { user }: { user: { id: number } },
) => {
  const url = new URL(req.url)
  const targetUserId = parseInt(url.pathname.split('/').slice(-1)[0], 10)

  if (isNaN(targetUserId)) {
    return Response.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  // Prevent deleting self
  if (targetUserId === user.id) {
    return Response.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, targetUserId))
    .returning()

  if (!deleted) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  return new Response(null, { status: 204 })
})
