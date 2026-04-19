import { pgTable, serial, text, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const visibilityEnum = pgEnum('collection_visibility', ['private', 'unlisted', 'public'])

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon'),
  visibility: visibilityEnum('visibility').notNull().default('private'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const links = pgTable('links', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  faviconUrl: text('favicon_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  collectionIdx: index('links_collection_id_idx').on(table.collectionId),
}))
