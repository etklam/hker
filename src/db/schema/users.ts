import { pgTable, serial, text, boolean, timestamp, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'superadmin'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').notNull().default('user'),
  banned: boolean('banned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueEmail: uniqueIndex('users_email_unique').on(table.email),
}))
