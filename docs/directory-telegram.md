# Telegram operations and acceptance

Development defaults to `TELEGRAM_DELIVERY_MODE=mock`: even a configured token does not make network requests. Unit and integration acceptance mocks transport or `fetch`. Real delivery requires `TELEGRAM_DELIVERY_MODE=live`; outside production, it also requires `TELEGRAM_TEST_CHAT_ID` matching every message destination. A dedicated test bot/chat and explicit authorization are required before real acceptance. These changes do not register a webhook.

The webhook requires a matching `TELEGRAM_WEBHOOK_SECRET`, rejects bodies above 64 KB, and validates the update before handling it. `APP_BASE_URL` must be an HTTPS public origin so every listing has a detail-page destination, including links with schemes that Telegram buttons cannot open.

## Delivery runner

Run `npm run bot:run` once per minute using the deployment scheduler, and `npm run bot:cleanup` daily. Both are one-shot commands; monitor their exit code and the journal rather than starting overlapping long-lived processes. A run scans up to 100 due jobs. For larger backlogs, run again. No process restart or incoming Telegram retry is necessary for a saved reply to resume.

Each chat/user conversation admits at most 60 updates per rolling minute. Admission counts persisted journals under the conversation transaction lock before taxonomy/search work, so simultaneous requests cannot exceed the quota or create an unbounded job backlog. Extra updates receive successful HTTP acceptance (and callback acknowledgement where applicable), but no new menu, state change, or delivery job; users can retry after one minute. This quota is separate from webhook secret validation.

Planning holds one transaction connection and uses that executor for taxonomy and search. Network calls occur after commit. The durable journal records operation progress, attempt count, due time, terminal state, and an ownership token. A conversation is the chat/user pair. Session and job leases last two minutes and renew during delivery; expired leases can be reclaimed. Completion, progress, and release use the owner's token. A later update waits behind prior unfinished work in that conversation. Independent conversations can proceed separately.

The sender edits the session's coherent message after the first successful send. It checks the current taxonomy and listing snapshots before delivery: changed or unpublished content is replaced with an instruction to refresh. Menu nonces belong to the chat/user session; another user's buttons cannot modify it. Session navigation expires after 24 hours. An unavailable selected criterion remains restrictive until the user explicitly clears it.

The webhook starts callback acknowledgement concurrently with database planning, with a one-second transport timeout. Its failure is nonfatal. Once the reply plan commits, HTTP acceptance returns without waiting for Telegram delivery; Next.js `after` starts delivery after the response, and the durable runner recovers work if that callback is interrupted. Acknowledging a duplicate callback does not deliver its menu again. Retryable failures are network errors, HTTP/API 5xx, and 429; 429 respects bounded `retry_after` (up to one hour). Exponential retry delay has a five-minute cap; a job fails after six delivery attempts. Other API 4xx responses are terminal; `message is not modified` is a successful edit. No retry delay sleeps on a database connection.

Telegram can accept a request while the client loses its response, or the process can exit between acceptance and checkpointing. Retrying can therefore duplicate the initial message. This is **at-least-once recovery with an ambiguous-send duplication window**, not exactly-once delivery. Editing the known coherent message narrows subsequent duplication but does not eliminate the initial window.

## Retention and recovery

Cleanup retains terminal deduplication records for 30 days and removes idle sessions after seven days only when no nonterminal job references them. It preserves active leased work. Deduplication beyond 30 days is not guaranteed. Monitor pending/retry age and failed jobs:

```sql
SELECT status, count(*), min(created_at), min(next_attempt_at)
FROM directory_bot_updates GROUP BY status;
SELECT id, attempts, last_error, next_attempt_at
FROM directory_bot_updates WHERE status = 'failed' ORDER BY id DESC LIMIT 50;
```

A failed job is terminal and does not block later updates. After resolving a permanent cause, ask the user to submit a fresh command; do not blindly replay obsolete content. Legacy journals without a chat/user conversation key need explicit migration handling and user restart rather than inferred ownership.

## Locally reproducible acceptance

Use only the disposable `hker_directory_test` database with the forward migrations applied:

```sh
npm test -- src/server/catalog/bot-transport.test.ts src/app/api/telegram/webhook/route.test.ts
npm run test:integration -- integration/bot-hardening.test.ts
```

The integration suite covers a two-connection planning pool, more than 60 categories/tags, long labels with 50 selections, exact reserved `all`, shared-chat ownership, unavailable restrictions, stale unpublished journals, expired lease recovery, concurrent delivery, completed-update deduplication, owner-safe lease release, persisted 429 scheduling, permanent failures and message editing. Legacy catalog integration cases retain configured navigation, multi-tag selection, result pagination, invalid callback and retry coverage.

External acceptance still needs an authorized dedicated chat: exercise `/start`, `/help`, `/all`, `/categories`, `/tags`, `/latest`, free text, `/price`, multiple tags and AND/OR; test two users in a group, a process restart after durable planning, actual scheduler execution, real Telegram rendering and the public detail URLs. Do not claim live Telegram acceptance from mocked tests.
