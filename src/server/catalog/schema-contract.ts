import { sql } from "drizzle-orm";
import { db } from "@/server/db";

const web = {
  directory_categories: ["id", "name", "slug", "enabled", "sort_order"],
  directory_areas: ["id", "parent_id", "name", "slug", "enabled", "sort_order"],
  directory_tag_groups: ["id", "name", "slug", "public_visible", "bot_visible", "enabled"],
  directory_tags: ["id", "name", "slug", "group_id", "public_visible", "bot_visible", "filterable", "enabled"],
  directory_listings: ["id", "name", "slug", "aliases", "revision", "short_description", "description", "category_id", "area_id", "price_min", "price_max", "price_currency", "attrs", "featured", "enabled"],
  directory_listing_links: ["id", "listing_id", "type", "label", "url", "sort_order", "enabled"],
  directory_listing_tags: ["listing_id", "tag_id"],
  directory_listing_slug_aliases: ["slug", "listing_id"],
  directory_navigation_presets: ["id", "label", "placement", "category_id", "area_id", "price_min", "price_max", "match_mode", "enabled"],
  directory_navigation_preset_tags: ["preset_id", "tag_id"],
} as const;

const worker = {
  directory_bot_sessions: ["key", "state", "message_id", "lease_owner", "locked_until", "updated_at"],
  directory_bot_updates: ["id", "conversation_key", "chat_key", "status", "attempts", "next_attempt_at", "operations", "next_operation", "locked_until", "lease_owner", "created_at"],
  directory_bot_chat_leases: ["key", "lease_owner", "locked_until", "updated_at"],
  directory_bot_runner_state: ["key", "heartbeat_at", "runner_id", "updated_at"],
} as const;

const release = {
  users: ["id", "email", "role"],
  auth_identities: ["id", "user_id", "provider", "provider_subject", "password_hash"],
  auth_sessions: ["id", "user_id", "expires_at"],
  directory_import_jobs: ["key", "digest", "result", "created_at"],
  directory_content_plans: ["id", "actor_id", "kind", "digest", "payload", "result", "expires_at"],
  directory_content_history: ["id", "actor_id", "entity", "entity_id", "action", "changes", "created_at"],
  directory_event_days: ["day", "source", "kind", "key", "count", "zero_count"],
  directory_event_receipts: ["id", "created_at"],
  directory_maintenance_runs: ["id", "kind", "status", "started_at", "finished_at", "counts", "error_class"],
} as const;

export type DirectorySchemaComponent = "web" | "worker" | "release";
type ColumnRow = { tableName: string; columnName: string };

const requirements: Record<DirectorySchemaComponent, Record<string, readonly string[]>> = {
  web,
  worker: { ...web, ...worker },
  release: { ...web, ...worker, ...release },
};

export async function inspectDirectorySchema(
  component: DirectorySchemaComponent,
  executor: Pick<typeof db, "execute"> = db,
) {
  const required = requirements[component];
  const tableNames = Object.keys(required);
  const rows = await executor.execute<ColumnRow>(sql`
    select table_name as "tableName", column_name as "columnName"
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (${sql.join(tableNames.map((name) => sql`${name}`), sql`, `)})
  `);
  const present = new Set(rows.map((row) => `${row.tableName}.${row.columnName}`));
  const missing = tableNames.flatMap((table) =>
    required[table as keyof typeof required]
      .filter((column) => !present.has(`${table}.${column}`))
      .map((column) => `${table}.${column}`),
  );
  return { component, compatible: missing.length === 0, missing };
}

export async function assertDirectorySchema(component: DirectorySchemaComponent) {
  const result = await inspectDirectorySchema(component);
  if (!result.compatible)
    throw new Error(`Incompatible ${component} schema: ${result.missing.join(", ")}`);
  return result;
}
