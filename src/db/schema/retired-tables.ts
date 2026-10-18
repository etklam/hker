/**
 * RETIRED TABLES — NOT PART OF THE PRODUCT.
 *
 * Collections, Spaces, Marketplace and Bills were retired (see PRODUCT.md and
 * AGENTS.md). No application code imports anything from this file, `db.ts` does
 * not register these tables, and the HTTP surface for all of them returns 410
 * via `src/lib/retired-routes.ts`.
 *
 * It exists for exactly one reason: `drizzle.config.ts` globs
 * `./src/db/schema/*`, and the tables still exist in the database — no
 * migration has ever dropped them. Delete this file and the next
 * `npm run db:generate` emits `DROP TABLE` for all fifteen of them.
 *
 * Do not import from here. Do not add to it. Do not use it to resurrect a
 * retired feature — that is explicitly forbidden by AGENTS.md.
 *
 * To actually remove these tables, write an owner-approved forward migration
 * that drops them, then delete this file in the same change.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/* ── collections ──────────────────────────────────────────────── */

export const visibilityEnum = pgEnum("collection_visibility", [
  "private",
  "unlisted",
  "public",
]);

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  visibility: visibilityEnum("visibility").notNull().default("private"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const links = pgTable(
  "links",
  {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    faviconUrl: text("favicon_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    collectionIdx: index("links_collection_id_idx").on(table.collectionId),
  }),
);

/* ── collection collaboration ─────────────────────────────────── */

export const collectionMemberRoleEnum = pgEnum("collection_member_role", [
  "viewer",
  "editor",
]);

export const collectionMembers = pgTable(
  "collection_members",
  {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: collectionMemberRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueCollectionUser: uniqueIndex(
      "collection_members_collection_user_unique",
    ).on(table.collectionId, table.userId),
  }),
);

export const collectionInviteLinks = pgTable("collection_invite_links", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: collectionMemberRoleEnum("role").notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ── marketplace ──────────────────────────────────────────────── */

export const marketplaceListings = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id")
    .notNull()
    .unique()
    .references(() => collections.id, { onDelete: "cascade" }),
  publisherId: integer("publisher_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  subscriberCount: integer("subscriber_count").notNull().default(0),
  forkCount: integer("fork_count").notNull().default(0),
  publisherAnonymous: boolean("publisher_anonymous").notNull().default(false),
  active: boolean("active").notNull().default(true),
  pinned: boolean("pinned").notNull().default(false),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    listingId: integer("listing_id")
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueUserListing: uniqueIndex("subscriptions_user_listing_unique").on(
      table.userId,
      table.listingId,
    ),
  }),
);

export const forks = pgTable(
  "forks",
  {
    id: serial("id").primaryKey(),
    sourceCollectionId: integer("source_collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    forkedCollectionId: integer("forked_collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    forkedBy: integer("forked_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueFork: uniqueIndex("forks_source_forked_by_unique").on(
      table.sourceCollectionId,
      table.forkedBy,
    ),
  }),
);

/* ── spaces ───────────────────────────────────────────────────── */

export const spaceRoleEnum = pgEnum("space_role", ["owner", "admin", "member"]);
export const spaceTodoPriorityEnum = pgEnum("space_todo_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const spaces = pgTable("spaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const spaceMembers = pgTable(
  "space_members",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: spaceRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueSpaceUser: uniqueIndex("space_members_space_user_unique").on(
      table.spaceId,
      table.userId,
    ),
  }),
);

export const spaceLists = pgTable("space_lists", {
  id: serial("id").primaryKey(),
  spaceId: integer("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const spaceTodos = pgTable(
  "space_todos",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => spaceLists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    assignedTo: integer("assigned_to").references(() => users.id),
    priority: spaceTodoPriorityEnum("priority").notNull().default("medium"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: integer("completed_by").references(() => users.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    listIdx: index("space_todos_list_id_idx").on(table.listId),
  }),
);

export const spaceInviteLinks = pgTable("space_invite_links", {
  id: serial("id").primaryKey(),
  spaceId: integer("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ── monthly bills ────────────────────────────────────────────── */

export const monthlyBillLists = pgTable(
  "monthly_bill_lists",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sharedSpaceId: integer("shared_space_id").references(() => spaces.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ownerIdx: index("monthly_bill_lists_owner_id_idx").on(table.ownerId),
    sharedSpaceIdx: index("monthly_bill_lists_shared_space_id_idx").on(
      table.sharedSpaceId,
    ),
  }),
);

export const monthlyBillItems = pgTable(
  "monthly_bill_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => monthlyBillLists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dueDay: integer("due_day").notNull(),
    amountCents: integer("amount_cents"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    listIdx: index("monthly_bill_items_list_id_idx").on(table.listId),
  }),
);

export const monthlyBillChecks = pgTable(
  "monthly_bill_checks",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => monthlyBillItems.id, { onDelete: "cascade" }),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    checkedBy: integer("checked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    itemPeriodUnique: uniqueIndex("monthly_bill_checks_item_period_unique").on(
      table.itemId,
      table.periodYear,
      table.periodMonth,
    ),
    periodIdx: index("monthly_bill_checks_period_idx").on(
      table.periodYear,
      table.periodMonth,
    ),
  }),
);
