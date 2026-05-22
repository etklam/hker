import { NextRequest } from 'next/server'
import { withAdmin } from '@/server/api-helpers'
import { db } from '@/server/db'
import { marketplaceListings } from '@/db/schema/marketplace'
import { eq } from 'drizzle-orm'

export const POST = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const listingId = parseInt(url.pathname.split('/').slice(-2)[0], 10)

  if (isNaN(listingId)) {
    return Response.json({ error: 'Invalid listing ID' }, { status: 400 })
  }

  const [updated] = await db
    .update(marketplaceListings)
    .set({ pinned: true, pinnedAt: new Date() })
    .where(eq(marketplaceListings.id, listingId))
    .returning()

  if (!updated) {
    return Response.json({ error: 'Listing not found' }, { status: 404 })
  }

  return Response.json({ listing: updated })
})
