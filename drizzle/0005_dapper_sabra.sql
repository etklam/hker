CREATE INDEX "directory_bot_session_updated_idx" ON "directory_bot_sessions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "directory_bot_update_due_idx" ON "directory_bot_updates" USING btree ("status","next_attempt_at","id");--> statement-breakpoint
CREATE INDEX "directory_bot_update_conversation_idx" ON "directory_bot_updates" USING btree ("conversation_key","id");--> statement-breakpoint
CREATE INDEX "directory_bot_update_completed_idx" ON "directory_bot_updates" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "directory_slug_alias_listing_idx" ON "directory_listing_slug_aliases" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "directory_event_receipt_created_idx" ON "directory_event_receipts" USING btree ("created_at");