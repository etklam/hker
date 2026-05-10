import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as usersSchema from '@/db/schema/users'
import * as authSchema from '@/db/schema/auth'
import * as collectionsSchema from '@/db/schema/collections'
import * as marketplaceSchema from '@/db/schema/marketplace'
import * as collaborationSchema from '@/db/schema/collaboration'
import * as familyTodoSchema from '@/db/schema/familyTodo'
import * as monthlyBillsSchema from '@/db/schema/monthlyBills'
import * as rateLimitSchema from '@/db/schema/rateLimit'
import { installPostgresSerializerGuards } from '@/server/postgres-serializers'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL environment variable is required')

const client = postgres(connectionString, { max: 20, idle_timeout: 30 })

export const db = drizzle(client, {
  schema: {
    ...usersSchema,
    ...authSchema,
    ...collectionsSchema,
    ...marketplaceSchema,
    ...collaborationSchema,
    ...familyTodoSchema,
    ...monthlyBillsSchema,
    ...rateLimitSchema,
  },
})
installPostgresSerializerGuards(client)

export type DB = typeof db
