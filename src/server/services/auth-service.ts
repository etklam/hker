import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { authIdentities } from '@/db/schema/auth'
import { AppError } from '@/lib/errors'
import * as userService from '@/server/services/user-service'

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16)
    scrypt(password, salt, 64, { N: 65536, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`)
    })
  })
}

function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [saltHex, hashHex] = stored.split(':')
    const salt = Buffer.from(saltHex, 'hex')
    const storedHash = Buffer.from(hashHex, 'hex')
    scrypt(password, salt, 64, { N: 65536, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(timingSafeEqual(storedHash, derivedKey))
    })
  })
}

export async function register(email: string, password: string, displayName?: string) {
  const normalizedEmail = email.toLowerCase()
  const passwordHashValue = await hashPassword(password)

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert((await import('@/db/schema/users')).users)
      .values({
        email: normalizedEmail,
        displayName: displayName ?? null,
      })
      .returning()

    await tx.insert(authIdentities).values({
      userId: user.id,
      provider: 'password',
      providerSubject: normalizedEmail,
      passwordHash: passwordHashValue,
      email: normalizedEmail,
    })

    return user
  })
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase()

  const [identity] = await db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, 'password'),
        eq(authIdentities.providerSubject, normalizedEmail),
      ),
    )
    .limit(1)

  if (!identity || !identity.passwordHash) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password')
  }

  const valid = await verifyPassword(password, identity.passwordHash)
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password')
  }

  const user = await userService.findById(identity.userId)
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password')
  }

  await db
    .update(authIdentities)
    .set({ lastUsedAt: new Date() })
    .where(eq(authIdentities.id, identity.id))

  return user
}
