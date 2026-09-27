BEGIN;
DO $$ BEGIN IF current_database() NOT IN ('hker_directory_test', 'hker_directory_fresh_test') THEN RAISE EXCEPTION 'Use an isolated directory test database'; END IF; END $$;
INSERT INTO directory_bot_updates(id,conversation_key,status,next_attempt_at,operations)
SELECT 800000000+n,'measure-'||(n%100),CASE WHEN n%100=0 THEN 'pending' ELSE 'complete' END,now()-interval '1 minute','[]'::jsonb FROM generate_series(1,10000) n;
ANALYZE directory_bot_updates;
EXPLAIN (ANALYZE,BUFFERS) SELECT id FROM directory_bot_updates WHERE status='pending' AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 100;
EXPLAIN (ANALYZE,BUFFERS) SELECT id FROM directory_bot_updates WHERE conversation_key='measure-1' AND id<800010000 AND status NOT IN ('complete','failed') LIMIT 1;
ROLLBACK;
