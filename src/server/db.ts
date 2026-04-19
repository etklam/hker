import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as usersSchema from '@/db/schema/users'
import * as authSchema from '@/db/schema/auth'
import * as collectionsSchema from '@/db/schema/collections'
import * as marketplaceSchema from '@/db/schema/marketplace'
import * as collaborationSchema from '@/db/schema/collaboration'
import * as familyTodoSchema from '@/db/schema/familyTodo'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString)

export const db = drizzle(client, {
  schema: {
    ...usersSchema,
    ...authSchema,
    ...collectionsSchema,
    ...marketplaceSchema,
    ...collaborationSchema,
    ...familyTodoSchema,
  },
})

export type DB = typeof db
