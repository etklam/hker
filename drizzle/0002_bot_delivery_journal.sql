ALTER TABLE "directory_bot_updates" ADD COLUMN "operations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "next_operation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_bot_updates" ADD COLUMN "locked_until" timestamp with time zone;