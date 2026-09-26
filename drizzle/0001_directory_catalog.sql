CREATE TABLE "directory_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "directory_areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "directory_bot_sessions" (
	"key" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_bot_updates" (
	"id" integer PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "directory_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "directory_listing_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_listing_tags" (
	"listing_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "directory_listing_tags_listing_id_tag_id_pk" PRIMARY KEY("listing_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "directory_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category_id" integer,
	"area_id" integer,
	"price_min" numeric(12, 2),
	"price_max" numeric(12, 2),
	"price_currency" text DEFAULT 'HKD' NOT NULL,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directory_listings_slug_unique" UNIQUE("slug"),
	CONSTRAINT "directory_listing_price" CHECK (("directory_listings"."price_min" is null or "directory_listings"."price_min" >= 0) and ("directory_listings"."price_max" is null or "directory_listings"."price_max" >= 0) and ("directory_listings"."price_min" is null or "directory_listings"."price_max" is null or "directory_listings"."price_max" >= "directory_listings"."price_min"))
);
--> statement-breakpoint
CREATE TABLE "directory_navigation_preset_tags" (
	"preset_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "directory_navigation_preset_tags_preset_id_tag_id_pk" PRIMARY KEY("preset_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "directory_navigation_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"placement" text DEFAULT 'both' NOT NULL,
	"icon" text,
	"category_id" integer,
	"area_id" integer,
	"price_min" numeric(12, 2),
	"price_max" numeric(12, 2),
	"match_mode" text DEFAULT 'and' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_tag_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_tag_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bot_visible" boolean DEFAULT true NOT NULL,
	"public_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "directory_tag_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "directory_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"group_id" integer,
	"public_visible" boolean DEFAULT true NOT NULL,
	"bot_visible" boolean DEFAULT true NOT NULL,
	"bot_featured" boolean DEFAULT false NOT NULL,
	"filterable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "directory_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "directory_areas" ADD CONSTRAINT "directory_areas_parent_id_directory_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."directory_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listing_links" ADD CONSTRAINT "directory_listing_links_listing_id_directory_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."directory_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listing_tags" ADD CONSTRAINT "directory_listing_tags_listing_id_directory_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."directory_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listing_tags" ADD CONSTRAINT "directory_listing_tags_tag_id_directory_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."directory_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD CONSTRAINT "directory_listings_category_id_directory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."directory_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD CONSTRAINT "directory_listings_area_id_directory_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."directory_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_preset_tags" ADD CONSTRAINT "directory_navigation_preset_tags_preset_id_directory_navigation_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."directory_navigation_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_preset_tags" ADD CONSTRAINT "directory_navigation_preset_tags_tag_id_directory_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."directory_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" ADD CONSTRAINT "directory_navigation_presets_category_id_directory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."directory_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_navigation_presets" ADD CONSTRAINT "directory_navigation_presets_area_id_directory_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."directory_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_tag_aliases" ADD CONSTRAINT "directory_tag_aliases_tag_id_directory_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."directory_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_tags" ADD CONSTRAINT "directory_tags_group_id_directory_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."directory_tag_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "directory_listing_category" ON "directory_listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "directory_listing_area" ON "directory_listings" USING btree ("area_id");