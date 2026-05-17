import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { spaces } from './space'

export const monthlyBillLists = pgTable('monthly_bill_lists', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sharedSpaceId: integer('shared_space_id').references(() => spaces.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index('monthly_bill_lists_owner_id_idx').on(table.ownerId),
  sharedSpaceIdx: index('monthly_bill_lists_shared_space_id_idx').on(table.sharedSpaceId),
}))

export const monthlyBillItems = pgTable('monthly_bill_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull().references(() => monthlyBillLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dueDay: integer('due_day').notNull(),
  amountCents: integer('amount_cents'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listIdx: index('monthly_bill_items_list_id_idx').on(table.listId),
}))

export const monthlyBillChecks = pgTable('monthly_bill_checks', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => monthlyBillItems.id, { onDelete: 'cascade' }),
  periodYear: integer('period_year').notNull(),
  periodMonth: integer('period_month').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  checkedBy: integer('checked_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  itemPeriodUnique: uniqueIndex('monthly_bill_checks_item_period_unique').on(
    table.itemId,
    table.periodYear,
    table.periodMonth,
  ),
  periodIdx: index('monthly_bill_checks_period_idx').on(table.periodYear, table.periodMonth),
}))
