import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  date,
  primaryKey,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
export const catalogImportJobs = pgTable("directory_import_jobs", {
  key: text("key").primaryKey(),
  digest: text("digest").notNull(),
  result: jsonb("result")
    .$type<{ imported: number; skipped: number; ids: number[] }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const catalogEventDays = pgTable(
  "directory_event_days",
  {
    day: date("day").notNull(),
    source: text("source").notNull(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
    zeroCount: integer("zero_count").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.day, t.source, t.kind, t.key] }),
    counters: check("directory_event_counter_valid", sql`${t.count} >= 0 and ${t.zeroCount} >= 0 and ${t.zeroCount} <= ${t.count}`),
    dimensions: check("directory_event_dimensions_valid", sql`${t.source} in ('web','bot') and ${t.kind} in ('search','filter','preset','tag','outbound') and length(${t.key}) between 1 and 80`),
  }),
);
export const catalogEventReceipts = pgTable(
  "directory_event_receipts",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    retention: index("directory_event_receipt_created_idx").on(t.createdAt),
  }),
);

export const catalogPlans = pgTable(
  "directory_content_plans",
  {
    id: text("id").primaryKey(),
    actorId: integer("actor_id").notNull(),
    kind: text("kind").notNull(),
    digest: text("digest").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<{
      created: number;
      updated: number;
      skipped: number;
      unchanged: number;
      rejected?: number;
      affected: {
        id: number;
        slug: string;
        revision?: number;
        enabled: boolean;
      }[];
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    expiry: index("directory_content_plan_expiry_idx").on(t.expiresAt),
    actor: index("directory_content_plan_actor_idx").on(t.actorId, t.createdAt),
  }),
);

export const catalogHistory = pgTable(
  "directory_content_history",
  {
    id: text("id").primaryKey(),
    actorId: integer("actor_id"),
    entity: text("entity").notNull(),
    entityId: integer("entity_id").notNull(),
    action: text("action").notNull(),
    beforeRevision: integer("before_revision"),
    afterRevision: integer("after_revision"),
    changes: jsonb("changes")
      .$type<Record<string, { before: unknown; after: unknown }>>()
      .notNull(),
    operationId: text("operation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    entity: index("directory_content_history_entity_idx").on(
      t.entity,
      t.entityId,
      t.createdAt,
    ),
    retention: index("directory_content_history_created_idx").on(t.createdAt),
  }),
);
