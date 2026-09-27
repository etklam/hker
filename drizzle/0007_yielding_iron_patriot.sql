CREATE TABLE "directory_content_history" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"before_revision" integer,
	"after_revision" integer,
	"changes" jsonb NOT NULL,
	"operation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_content_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" integer NOT NULL,
	"kind" text NOT NULL,
	"digest" text NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "directory_content_history_entity_idx" ON "directory_content_history" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "directory_content_history_created_idx" ON "directory_content_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "directory_content_plan_expiry_idx" ON "directory_content_plans" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "directory_content_plan_actor_idx" ON "directory_content_plans" USING btree ("actor_id","created_at");