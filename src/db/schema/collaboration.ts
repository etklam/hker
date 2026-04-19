import { pgTable, serial, integer, text, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'
import { collections } from './collections'

export const collectionMemberRoleEnum = pgEnum('collection_member_role', ['viewer', 'editor'])

export const collectionMembers = pgTable('collection_members', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: collectionMemberRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueCollectionUser: uniqueIndex('collection_members_collection_user_unique').on(table.collectionId, table.userId),
}))

export const collectionInviteLinks = pgTable('collection_invite_links', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  role: collectionMemberRoleEnum('role').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
