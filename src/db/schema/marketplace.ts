import { pgTable, serial, integer, boolean, timestamp, uniqueIndex, text } from 'drizzle-orm/pg-core'
import { users } from './users'
import { collections } from './collections'

export const marketplaceListings = pgTable('marketplace_listings', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().unique().references(() => collections.id, { onDelete: 'cascade' }),
  publisherId: integer('publisher_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  subscriberCount: integer('subscriber_count').notNull().default(0),
  forkCount: integer('fork_count').notNull().default(0),
  publisherAnonymous: boolean('publisher_anonymous').notNull().default(false),
  active: boolean('active').notNull().default(true),
  pinned: boolean('pinned').notNull().default(false),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
})

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  listingId: integer('listing_id').notNull().references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueUserListing: uniqueIndex('subscriptions_user_listing_unique').on(table.userId, table.listingId),
}))

export const forks = pgTable('forks', {
  id: serial('id').primaryKey(),
  sourceCollectionId: integer('source_collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  forkedCollectionId: integer('forked_collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  forkedBy: integer('forked_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueFork: uniqueIndex('forks_source_forked_by_unique').on(table.sourceCollectionId, table.forkedBy),
}))
