CREATE TABLE "directory_maintenance_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_class" text,
	CONSTRAINT "directory_maintenance_run_valid" CHECK ("directory_maintenance_runs"."kind" = 'retention' and "directory_maintenance_runs"."status" in ('succeeded', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "directory_maintenance_run_recent_idx" ON "directory_maintenance_runs" USING btree ("kind","started_at");