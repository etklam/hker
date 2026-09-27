# HKER — Hong Kong local directory

A curated directory of shops, services, attractions, online resources and communities. Listings are independent of the retired collection marketplace. Public web, administrator tools and Telegram use the same catalog search service.

## Local development

```sh
nvm use # Node 24
npm ci
# Configure DATABASE_URL, AUTH_SESSION_SECRET and APP_BASE_URL first.
npm run db:migrate:safe
npm run dev
```

**Existing installations:** the old migrations were squashed into `0000_initial_schema`. Inspect `drizzle.__drizzle_migrations` and the existing schema before migrating. Do not replay the baseline over an older deployed schema. Back up, reconcile the ledger in a staging clone, then deploy. New directory migrations are additive; no legacy tables are dropped.

Required environment:

- `DATABASE_URL`: PostgreSQL connection URL.
- `APP_BASE_URL`: absolute public origin; HTTPS in production.
- `AUTH_SESSION_SECRET`: long random secret, unchanged from the existing installation.
- `AUTH_SESSION_COOKIE_NAME`: defaults to `__Host-hker_session`. Use `hker_session` for plain HTTP local development; the `__Host-` prefix requires HTTPS.
- `TELEGRAM_BOT_TOKEN`: token for the bot.
- `TELEGRAM_WEBHOOK_SECRET`: random 1–256 character Telegram-compatible secret (`A-Z`, `a-z`, `0-9`, `_`, `-`). Register `/api/telegram/webhook` through Telegram's `setWebhook` API with **the same value in `secret_token`**. Keep both secrets server-side.

Public registration and legacy routes return 410. Existing admin/superadmin accounts remain valid. For a new database, create an administrator with `npm run admin:create` using `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optional `ADMIN_NAME` environment variables. It reuses the password authentication service, never changes an existing account, and should be run from a trusted terminal. Do not put credentials in source control.

## Interfaces

- `/`: search-first homepage and configured featured listings.
- `/search`: shareable category, area, tag, price and sort filters; supports `category`, `area`, `tags` slugs as well as IDs.
- `/listing/:slug`: public listing, available links and metadata.
- `/admin`: guarded management shell with listing table, editors, taxonomies, navigation presets, draft CSV imports and inventory counts.
- Telegram: `/start`, configured buttons, groups/tags, category/area/price filters, text search and result pagination. `/price 100 500` sets a range; `*` is an open bound.

## Rules

`src/server/catalog/service.ts` is the catalog boundary. Public listing visibility is `enabled=true` for website, API, metadata and bot. Disabled taxonomies disappear from navigation and labels; they do not unpublish the listing. Structured filters require visible/enabled taxonomies. Tags combine with AND by default. Prices filter on interval overlap in HKD; both null means unknown and does not match price filters. Attributes are explicitly public key/value metadata.

Search combines a PostgreSQL full-text GIN index with escaped Chinese substring matching and taxonomy aliases. Chinese substring matching remains a scan in v1; assess real catalog scale before adding pg_trgm. No external search engine is required.

Telegram stores selection state and per-update delivery progress in PostgreSQL. State expires after 24 hours. Reply plans commit before network sends; duplicate completed updates do not resend, and failed delivery resumes. Telegram sendMessage has no idempotency key: a process crash after Telegram accepts a message but before its acknowledgement is stored can still duplicate that one message. Delivery leases, retry attempts, maximum job age and jittered backoff use the `BOT_*` settings in `.env.example`. This is a PostgreSQL delivery journal, not an external queue.

Build the operational scripts before starting a long-running delivery worker. The status command reports queue counts, oldest outstanding work, error classes and the latest runner heartbeat without exposing message payloads.

```sh
npm run ops:build
node .ops/bot-runner.cjs --watch
node .ops/bot-runner.cjs --status
node .ops/bot-runner.cjs --cleanup
```

## Validation

```sh
npm run typecheck
npm run lint
npm test -- --maxWorkers=4
# Isolated PostgreSQL only; integration suite refuses other database names.
DATABASE_URL=postgres://.../hker_directory_test npm run db:migrate:safe
DATABASE_URL=postgres://.../hker_directory_test npm run test:integration
npm run build
```

See [phase reports and migration map](docs/directory-rebuild-plan.md). Historical product documents and source remain for data-retention review; this README, PRODUCT.md and DESIGN.md describe the new product.

## Release acceptance

The current [Phase 10 handover](docs/directory-phase10-beta-handover.md), [evidence matrix](docs/directory-release-matrix.md) and [release checklist](docs/directory-release-checklist.md) define current evidence and release gates. `npm run test:acceptance` requires a guarded disposable DB, exercises fresh/upgrade migrations and browser workflows. `npm run ops:rehearsal` builds one isolated candidate image and exercises Docker Compose deployment, recovery and rollback compatibility with mocked Telegram. Runtime secrets are supplied only when running the container.
