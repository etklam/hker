CREATE TABLE "directory_listing_slug_aliases" (
	"slug" text PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_event_days" (
	"day" date NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"zero_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "directory_event_days_day_source_kind_key_pk" PRIMARY KEY("day","source","kind","key")
);
--> statement-breakpoint
CREATE TABLE "directory_event_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_import_jobs" (
	"key" text PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "directory_listing_tags" DROP CONSTRAINT "directory_listing_tags_tag_id_directory_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_listings" DROP CONSTRAINT "directory_listings_category_id_directory_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_listings" DROP CONSTRAINT "directory_listings_area_id_directory_areas_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_navigation_preset_tags" DROP CONSTRAINT "directory_navigation_preset_tags_tag_id_directory_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" DROP CONSTRAINT "directory_navigation_presets_category_id_directory_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" DROP CONSTRAINT "directory_navigation_presets_area_id_directory_areas_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_tags" DROP CONSTRAINT "directory_tags_group_id_directory_tag_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_bot_sessions" ADD COLUMN "message_id" integer;--> statement-breakpoint
ALTER TABLE "directory_bot_sessions" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "directory_bot_sessions" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "conversation_key" text;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_listing_slug_aliases" ADD CONSTRAINT "directory_listing_slug_aliases_listing_id_directory_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."directory_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listing_tags" ADD CONSTRAINT "directory_listing_tags_tag_id_directory_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."directory_tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD CONSTRAINT "directory_listings_category_id_directory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."directory_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD CONSTRAINT "directory_listings_area_id_directory_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."directory_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_preset_tags" ADD CONSTRAINT "directory_navigation_preset_tags_tag_id_directory_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."directory_tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" ADD CONSTRAINT "directory_navigation_presets_category_id_directory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."directory_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" ADD CONSTRAINT "directory_navigation_presets_area_id_directory_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."directory_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_tags" ADD CONSTRAINT "directory_tags_group_id_directory_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."directory_tag_groups"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
UPDATE directory_bot_updates SET status = CASE WHEN next_operation >= jsonb_array_length(operations) THEN 'complete' ELSE 'failed' END, completed_at = created_at, last_error = CASE WHEN next_operation < jsonb_array_length(operations) THEN 'Legacy journal requires user restart' ELSE NULL END WHERE conversation_key IS NULL;
