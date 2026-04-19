import { eq, inArray } from 'drizzle-orm'
import { db } from '@/server/db'
import { users } from '@/db/schema/users'

export async function createUser(email: string, displayName?: string) {
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      displayName: displayName ?? null,
    })
    .returning()
  return user
}

export async function findByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  return result[0] ?? null
}

export async function findById(id: number) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function fetchUsersById(ids: number[]) {
  if (ids.length === 0) return new Map<number, typeof users.$inferSelect>()

  const rows = await db
    .select()
    .from(users)
    .where(inArray(users.id, ids))

  const map = new Map<number, typeof users.$inferSelect>()
  for (const row of rows) {
    map.set(row.id, row)
  }
  return map
}
