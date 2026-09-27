import {
  pgTable,
  text,
  integer,
  timestamp,
  date,
  primaryKey,
  jsonb,
  index,
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
  (t) => ({ pk: primaryKey({ columns: [t.day, t.source, t.kind, t.key] }) }),
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
