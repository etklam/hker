import { eq, asc, sql, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { links } from '@/db/schema/collections'
import { AppError } from '@/lib/errors'

function isPrivateIP(ip: string): boolean {
  if (ip === '::1') return true
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^224\./,
    /^0\./,
    /^255\./,
  ]
  return privateRanges.some((r) => r.test(ip))
}

export async function validateUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppError('INVALID_REQUEST', 'Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError('INVALID_REQUEST', 'Invalid URL scheme')
  }

  const { hostname } = parsed

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isPrivateIP(hostname)) {
    throw new AppError('INVALID_REQUEST', 'Invalid URL')
  }

  try {
    const { lookup } = await import('dns/promises')
    const addresses = await lookup(hostname, { all: true })
    for (const { address } of addresses) {
      if (isPrivateIP(address)) {
        throw new AppError('INVALID_REQUEST', 'Invalid URL')
      }
    }
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError('INVALID_REQUEST', 'Cannot resolve URL hostname')
  }
}

export async function listForCollection(collectionId: number) {
  return db
    .select()
    .from(links)
    .where(eq(links.collectionId, collectionId))
    .orderBy(asc(links.sortOrder))
}

export async function create(
  collectionId: number,
  data: { title: string; url: string; description?: string },
) {
  await validateUrl(data.url)

  const [maxOrder] = await db
    .select({ max: sql<number>`coalesce(max(${links.sortOrder}), -1)` })
    .from(links)
    .where(eq(links.collectionId, collectionId))

  const [row] = await db
    .insert(links)
    .values({
      collectionId,
      title: data.title,
      url: data.url,
      description: data.description ?? null,
      sortOrder: (maxOrder?.max ?? -1) + 1,
    })
    .returning()
  return row
}

export async function update(
  collectionId: number,
  linkId: number,
  data: { title?: string; url?: string; description?: string },
) {
  if (data.url !== undefined) {
    await validateUrl(data.url)
  }

  const [row] = await db
    .update(links)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(links.id, linkId), eq(links.collectionId, collectionId)))
    .returning()
  return row ?? null
}

export async function remove(collectionId: number, linkId: number) {
  const [row] = await db
    .delete(links)
    .where(and(eq(links.id, linkId), eq(links.collectionId, collectionId)))
    .returning()
  return row ?? null
}

export async function reorder(collectionId: number, ids: number[]) {
  for (let i = 0; i < ids.length; i++) {
    await db
      .update(links)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(and(eq(links.id, ids[i]), eq(links.collectionId, collectionId)))
  }
}
