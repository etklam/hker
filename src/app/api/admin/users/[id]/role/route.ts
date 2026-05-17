import { NextRequest } from 'next/server'
import { withSuperAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'
import type { UserRole } from '@/server/services/permission-service'

const VALID_ROLES: UserRole[] = ['user', 'admin', 'superadmin']

export const PUT = withSuperAdmin(async (
  req: NextRequest,
  { user }: { user: { id: number } },
) => {
  const url = new URL(req.url)
  const targetUserId = parseInt(url.pathname.split('/').slice(-2)[0], 10)

  if (isNaN(targetUserId)) {
    return Response.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  // Prevent superadmin from modifying their own role
  if (targetUserId === user.id) {
    return Response.json({ error: 'Cannot modify your own role' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { role } = body

  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const [updatedUser] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, targetUserId))
    .returning()

  if (!updatedUser) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  return Response.json({ user: updatedUser })
})
