CREATE TABLE "directory_bot_chat_leases" (
	"key" text PRIMARY KEY NOT NULL,
	"lease_owner" text,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_bot_runner_state" (
	"key" text PRIMARY KEY NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"runner_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "chat_key" text;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "error_class" text;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "directory_bot_updates" SET "chat_key" = split_part("conversation_key", ':', 1) WHERE "conversation_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "directory_bot_chat_updated_idx" ON "directory_bot_chat_leases" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "directory_bot_update_chat_idx" ON "directory_bot_updates" USING btree ("chat_key","id");--> statement-breakpoint
ALTER TABLE "directory_areas" ADD CONSTRAINT "directory_areas_identity" CHECK (length(trim("directory_areas"."name")) > 0 and length(trim("directory_areas"."slug")) > 0);--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD CONSTRAINT "directory_bot_progress" CHECK ("directory_bot_updates"."attempts" >= 0 and "directory_bot_updates"."next_operation" >= 0 and "directory_bot_updates"."next_operation" <= jsonb_array_length("directory_bot_updates"."operations") and "directory_bot_updates"."status" in ('pending', 'delivering', 'retry', 'complete', 'failed'));--> statement-breakpoint
ALTER TABLE "directory_categories" ADD CONSTRAINT "directory_categories_identity" CHECK (length(trim("directory_categories"."name")) > 0 and length(trim("directory_categories"."slug")) > 0);--> statement-breakpoint
ALTER TABLE "directory_listings" ADD CONSTRAINT "directory_listing_revision" CHECK ("directory_listings"."revision" > 0);--> statement-breakpoint
ALTER TABLE "directory_listings" ADD CONSTRAINT "directory_listing_identity" CHECK (length(trim("directory_listings"."name")) > 0 and length(trim("directory_listings"."slug")) > 0);--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" ADD CONSTRAINT "directory_preset_criteria" CHECK (length(trim("directory_navigation_presets"."label")) > 0 and "directory_navigation_presets"."match_mode" in ('and', 'or') and "directory_navigation_presets"."placement" in ('public', 'bot', 'both') and ("directory_navigation_presets"."price_min" is null or "directory_navigation_presets"."price_min" >= 0) and ("directory_navigation_presets"."price_max" is null or "directory_navigation_presets"."price_max" >= 0) and ("directory_navigation_presets"."price_min" is null or "directory_navigation_presets"."price_max" is null or "directory_navigation_presets"."price_min" <= "directory_navigation_presets"."price_max"));--> statement-breakpoint
ALTER TABLE "directory_tag_groups" ADD CONSTRAINT "directory_tag_groups_identity" CHECK (length(trim("directory_tag_groups"."name")) > 0 and length(trim("directory_tag_groups"."slug")) > 0);--> statement-breakpoint
ALTER TABLE "directory_tags" ADD CONSTRAINT "directory_tags_identity" CHECK (length(trim("directory_tags"."name")) > 0 and length(trim("directory_tags"."slug")) > 0);