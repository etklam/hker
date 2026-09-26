import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  primaryKey,
  check,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
const ordered = () => ({
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
});
const dates = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const categories = pgTable("directory_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  ...ordered(),
});
export const areas = pgTable("directory_areas", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").references((): AnyPgColumn => areas.id, {
    onDelete: "restrict",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ...ordered(),
});
export const tagGroups = pgTable("directory_tag_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  botVisible: boolean("bot_visible").notNull().default(true),
  publicVisible: boolean("public_visible").notNull().default(true),
  ...ordered(),
});
export const tags = pgTable("directory_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  groupId: integer("group_id").references(() => tagGroups.id, {
    onDelete: "set null",
  }),
  publicVisible: boolean("public_visible").notNull().default(true),
  botVisible: boolean("bot_visible").notNull().default(true),
  botFeatured: boolean("bot_featured").notNull().default(false),
  filterable: boolean("filterable").notNull().default(true),
  ...ordered(),
});
export const tagAliases = pgTable("directory_tag_aliases", {
  id: serial("id").primaryKey(),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
});
export const listings = pgTable(
  "directory_listings",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    areaId: integer("area_id").references(() => areas.id, {
      onDelete: "set null",
    }),
    priceMin: numeric("price_min", { precision: 12, scale: 2 }),
    priceMax: numeric("price_max", { precision: 12, scale: 2 }),
    priceCurrency: text("price_currency").notNull().default("HKD"),
    attrs: jsonb("attrs").$type<Record<string, string>>().notNull().default({}),
    featured: boolean("featured").notNull().default(false),
    ...ordered(),
    enabled: boolean("enabled").notNull().default(false),
    ...dates(),
  },
  (t) => ({
    price: check(
      "directory_listing_price",
      sql`(${t.priceMin} is null or ${t.priceMin} >= 0) and (${t.priceMax} is null or ${t.priceMax} >= 0) and (${t.priceMin} is null or ${t.priceMax} is null or ${t.priceMax} >= ${t.priceMin})`,
    ),
    category: index("directory_listing_category").on(t.categoryId),
    area: index("directory_listing_area").on(t.areaId),
    search: index("directory_listing_search").using(
      "gin",
      sql`to_tsvector('simple', ${t.name} || ' ' || ${t.shortDescription} || ' ' || ${t.description})`,
    ),
  }),
);
export const listingLinks = pgTable(
  "directory_listing_links",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    ...ordered(),
    ...dates(),
  },
  (t) => ({
    listing: index("directory_links_listing").on(
      t.listingId,
      t.enabled,
      t.sortOrder,
    ),
  }),
);
export const listingTags = pgTable(
  "directory_listing_tags",
  {
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.listingId, t.tagId] }) }),
);
export const navigationPresets = pgTable("directory_navigation_presets", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  placement: text("placement").notNull().default("both"),
  icon: text("icon"),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  areaId: integer("area_id").references(() => areas.id, {
    onDelete: "set null",
  }),
  priceMin: numeric("price_min", { precision: 12, scale: 2 }),
  priceMax: numeric("price_max", { precision: 12, scale: 2 }),
  matchMode: text("match_mode").notNull().default("and"),
  ...ordered(),
});
export const navigationPresetTags = pgTable(
  "directory_navigation_preset_tags",
  {
    presetId: integer("preset_id")
      .notNull()
      .references(() => navigationPresets.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.presetId, t.tagId] }) }),
);
export const botSessions = pgTable("directory_bot_sessions", {
  key: text("key").primaryKey(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const botUpdates = pgTable("directory_bot_updates", {
  id: integer("id").primaryKey(),
  operations: jsonb("operations")
    .$type<{ method: string; body: Record<string, unknown> }[]>()
    .notNull()
    .default([]),
  nextOperation: integer("next_operation").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
