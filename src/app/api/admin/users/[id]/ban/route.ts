import { NextRequest } from 'next/server'
import { withAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'

export const POST = withAdmin(async (
  req: NextRequest,
  { user }: { user: { id: number; role: string } },
) => {
  const url = new URL(req.url)
  const targetUserId = parseInt(url.pathname.split('/').slice(-2)[0], 10)

  if (isNaN(targetUserId)) {
    return Response.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  // Prevent banning self
  if (targetUserId === user.id) {
    return Response.json({ error: 'Cannot ban yourself' }, { status: 400 })
  }

  // Find target user to check superadmin
  const [targetUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)

  if (!targetUser) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  // Prevent banning superadmin
  if (targetUser.role === 'superadmin') {
    return Response.json({ error: 'Cannot ban superadmin' }, { status: 400 })
  }

  const [updatedUser] = await db
    .update(users)
    .set({ banned: true, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning()

  return Response.json({ user: updatedUser })
})
