CREATE TYPE "public"."collection_member_role" AS ENUM('viewer', 'editor');--> statement-breakpoint
CREATE TYPE "public"."collection_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TYPE "public"."space_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."space_todo_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'superadmin');--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"password_hash" text,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "collection_invite_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"token" text NOT NULL,
	"role" "collection_member_role" NOT NULL,
	"created_by" integer NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_invite_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "collection_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "collection_member_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"visibility" "collection_visibility" DEFAULT 'private' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"favicon_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_collection_id" integer NOT NULL,
	"forked_collection_id" integer NOT NULL,
	"forked_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"publisher_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"publisher_anonymous" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"pinned_at" timestamp with time zone,
	CONSTRAINT "marketplace_listings_collection_id_unique" UNIQUE("collection_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_bill_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"name" text NOT NULL,
	"due_day" integer NOT NULL,
	"amount_cents" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_bill_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" text NOT NULL,
	"shared_space_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"fail_count" integer DEFAULT 1 NOT NULL,
	"first_failure" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"hit_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_invite_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"token" text NOT NULL,
	"created_by" integer NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_invite_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "space_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "space_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigned_to" integer,
	"priority" "space_todo_priority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp with time zone,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_invite_links" ADD CONSTRAINT "collection_invite_links_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_invite_links" ADD CONSTRAINT "collection_invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_source_collection_id_collections_id_fk" FOREIGN KEY ("source_collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_forked_collection_id_collections_id_fk" FOREIGN KEY ("forked_collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_forked_by_users_id_fk" FOREIGN KEY ("forked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_checks" ADD CONSTRAINT "monthly_bill_checks_item_id_monthly_bill_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."monthly_bill_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_checks" ADD CONSTRAINT "monthly_bill_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_items" ADD CONSTRAINT "monthly_bill_items_list_id_monthly_bill_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."monthly_bill_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_lists" ADD CONSTRAINT "monthly_bill_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_lists" ADD CONSTRAINT "monthly_bill_lists_shared_space_id_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_invite_links" ADD CONSTRAINT "space_invite_links_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_invite_links" ADD CONSTRAINT "space_invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_lists" ADD CONSTRAINT "space_lists_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_todos" ADD CONSTRAINT "space_todos_list_id_space_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."space_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_todos" ADD CONSTRAINT "space_todos_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_todos" ADD CONSTRAINT "space_todos_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_todos" ADD CONSTRAINT "space_todos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_unique" ON "auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_members_collection_user_unique" ON "collection_members" USING btree ("collection_id","user_id");--> statement-breakpoint
CREATE INDEX "links_collection_id_idx" ON "links" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forks_source_forked_by_unique" ON "forks" USING btree ("source_collection_id","forked_by");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_listing_unique" ON "subscriptions" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_bill_checks_item_period_unique" ON "monthly_bill_checks" USING btree ("item_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "monthly_bill_checks_period_idx" ON "monthly_bill_checks" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "monthly_bill_items_list_id_idx" ON "monthly_bill_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "monthly_bill_lists_owner_id_idx" ON "monthly_bill_lists" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "monthly_bill_lists_shared_space_id_idx" ON "monthly_bill_lists" USING btree ("shared_space_id");--> statement-breakpoint
CREATE INDEX "login_failures_email_idx" ON "login_failures" USING btree ("email");--> statement-breakpoint
CREATE INDEX "rate_limit_entries_key_idx" ON "rate_limit_entries" USING btree ("key");--> statement-breakpoint
CREATE INDEX "rate_limit_entries_hit_at_idx" ON "rate_limit_entries" USING btree ("hit_at");--> statement-breakpoint
CREATE UNIQUE INDEX "space_members_space_user_unique" ON "space_members" USING btree ("space_id","user_id");--> statement-breakpoint
CREATE INDEX "space_todos_list_id_idx" ON "space_todos" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");