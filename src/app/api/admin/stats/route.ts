import { NextRequest } from 'next/server'
import { withAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { eq, sql } from 'drizzle-orm'
import { collections } from '@/db/schema/collections'
import { links } from '@/db/schema/collections'

export const GET = withAdmin(async (
  _req: NextRequest,
  { user: _admin }: { user: { id: number } },
) => {
  const [userCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)

  const [collectionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collections)

  const [linkCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(links)

  return Response.json({
    users: userCount.count,
    collections: collectionCount.count,
    links: linkCount.count,
  })
})
