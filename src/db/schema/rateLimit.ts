import { pgTable, serial, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

export const rateLimitEntries = pgTable('rate_limit_entries', {
  id: serial('id').primaryKey(),
  key: text('key').notNull(),
  hitAt: timestamp('hit_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyIdx: index('rate_limit_entries_key_idx').on(table.key),
  hitAtIdx: index('rate_limit_entries_hit_at_idx').on(table.hitAt),
}))

export const loginFailures = pgTable('login_failures', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  failCount: integer('fail_count').notNull().default(1),
  firstFailure: timestamp('first_failure', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
}, (table) => ({
  emailIdx: index('login_failures_email_idx').on(table.email),
}))
