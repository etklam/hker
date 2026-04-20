import { NextRequest } from 'next/server'
import { withAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { sql, desc } from 'drizzle-orm'

export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return Response.json({
    users: rows,
    total: countRow.count,
    page,
    totalPages: Math.ceil(countRow.count / limit),
  })
})
