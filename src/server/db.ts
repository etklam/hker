import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as operationsSchema from '@/db/schema/directoryOperations'
import * as directorySchema from '@/db/schema/directory'
import * as usersSchema from '@/db/schema/users'
import * as authSchema from '@/db/schema/auth'
import * as collectionsSchema from '@/db/schema/collections'
import * as marketplaceSchema from '@/db/schema/marketplace'
import * as collaborationSchema from '@/db/schema/collaboration'
import * as spaceSchema from '@/db/schema/space'
import * as monthlyBillsSchema from '@/db/schema/monthlyBills'
import * as rateLimitSchema from '@/db/schema/rateLimit'
import { installPostgresSerializerGuards } from '@/server/postgres-serializers'

const connectionString = process.env.DATABASE_URL
if (!connectionString && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('DATABASE_URL environment variable is required')

export function createDatabase(url: string, options: {max?:number; logger?: {logQuery(query: string, params: unknown[]): void}} = {}) {
const max = options.max ?? Number(process.env.DATABASE_POOL_MAX ?? 20)
if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error('Invalid database pool size')
const client = postgres(url, { max, idle_timeout: 30, connect_timeout: 10 })
const database = drizzle(client, {
  logger: options.logger,
  schema: {
    ...usersSchema,
    ...directorySchema,
    ...operationsSchema,
    ...authSchema,
    ...collectionsSchema,
    ...marketplaceSchema,
    ...collaborationSchema,
    ...spaceSchema,
    ...monthlyBillsSchema,
    ...rateLimitSchema,
  },
})
installPostgresSerializerGuards(client)
return {db: database, close: () => client.end({timeout:5})}
}
const configured = createDatabase(connectionString ?? 'postgres://build:build@127.0.0.1:1/build')
export const db = configured.db
export const closeDatabase = configured.close
export type DB = typeof db
