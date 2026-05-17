import { NextRequest } from 'next/server'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'
import { collections } from '@/db/schema/collections'
import { links } from '@/db/schema/collections'
import { eq, sql, and } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  // Find the superadmin user first, fall back to admin
  const [superadmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'superadmin'))
    .limit(1)

  const featuredUser = superadmin ?? (await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1))[0]

  if (!featuredUser) {
    return Response.json({ collections: [] })
  }

  // Get featured user's public collections
  const rows = await db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      icon: collections.icon,
      visibility: collections.visibility,
      sortOrder: collections.sortOrder,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collections)
    .where(
      and(
        eq(collections.ownerId, featuredUser.id),
        eq(collections.visibility, 'public'),
      ),
    )
    .orderBy(collections.sortOrder)

  // Get link counts
  const collectionIds = rows.map((r) => r.id)
  const linkCounts = new Map<number, number>()

  if (collectionIds.length > 0) {
    const counts = await db
      .select({
        collectionId: links.collectionId,
        count: sql<number>`count(*)::int`,
      })
      .from(links)
      .where(sql`${links.collectionId} = ANY(${collectionIds})`)
      .groupBy(links.collectionId)

    for (const row of counts) {
      linkCounts.set(row.collectionId, row.count)
    }
  }

  // Get links for each collection
  const collectionsWithLinks = await Promise.all(
    rows.map(async (row) => {
      const collectionLinks = await db
        .select({
          id: links.id,
          title: links.title,
          url: links.url,
          description: links.description,
          faviconUrl: links.faviconUrl,
          sortOrder: links.sortOrder,
        })
        .from(links)
        .where(eq(links.collectionId, row.id))
        .orderBy(links.sortOrder)
        .limit(20)

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        icon: row.icon,
        linkCount: linkCounts.get(row.id) ?? 0,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        links: collectionLinks,
      }
    }),
  )

  return Response.json({ collections: collectionsWithLinks })
}
