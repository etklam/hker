import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const familyTodoSpaceRoleEnum = pgEnum('family_todo_space_role', ['owner', 'admin', 'member'])
export const todoPriorityEnum = pgEnum('todo_priority', ['low', 'medium', 'high', 'urgent'])

export const familyTodoSpaces = pgTable('family_todo_spaces', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const familyTodoSpaceMembers = pgTable('family_todo_space_members', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => familyTodoSpaces.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: familyTodoSpaceRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueSpaceUser: uniqueIndex('space_members_space_user_unique').on(table.spaceId, table.userId),
}))

export const familyTodoLists = pgTable('family_todo_lists', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => familyTodoSpaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const familyTodos = pgTable('family_todos', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull().references(() => familyTodoLists.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: integer('assigned_to').references(() => users.id),
  priority: todoPriorityEnum('priority').notNull().default('medium'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: integer('completed_by').references(() => users.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listIdx: index('family_todos_list_id_idx').on(table.listId),
}))

export const familyTodoInviteLinks = pgTable('family_todo_invite_links', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => familyTodoSpaces.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
