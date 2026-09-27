> Phase 9 release candidate: [findings, current evidence and staging gates](directory-phase9-release-candidate.md). Earlier aggregate counts below are historical. No staging or live beta is certified.

> Phase 8 local implementation and verification complete: [content operations / import-export / analytics](directory-phase8-evidence.md). Fresh results: 569 unit, 72 isolated integration and 36 required-fixture Chromium tests passed, zero skips; migrations, production build and runtime image verified. Staging/live acceptance remains unperformed.

> Latest extended Phase 7 evidence: [extended acceptance matrix](directory-phase7-extended.md) and [performance observations](directory-performance-observations.md). Earlier counts below are historical; the extended final aggregate passed 547 unit / 60 integration / 34 Chromium tests with zero skips. Staging/live gates remain open.

> Phase 7 current scope and fresh evidence: [Phase 7 checklist](directory-phase7-checklist.md). The worktree already contained uncommitted hardening when this Phase 7 pass began; historical completion claims below are not new execution evidence. Advanced import formats and behavioral analytics remain outside Phase 7 acceptance/backlog; existing implementations were preserved, not newly requested or certified as complete.

> Historical phase report below is superseded by [release evidence](directory-release-matrix.md) and [release procedure](directory-release-checklist.md). In particular, inventory-only analytics, ID-only CSV, middleware-only retirement and the old audit result are obsolete.

# Hong Kong directory rebuild

## Phase 0 — audit and migration map
- Reuse Next App Router, React, TypeScript, Tailwind, Drizzle/PostgreSQL, session/auth services, withAdmin (CSRF and rate limits), Zod, Vitest/Playwright, Docker.
- Collections own links and membership/invites. Marketplace publications reference collections and publishers; subscriptions reference publications, forks reference source/destination collections. Collection visibility changes trigger unpublishing. These are not directory entities.
- Homepage `/api/featured` independently selects an administrator's public collections. Replace with catalog featured listings.
- Spaces own boards/lists/todos and memberships. Monthly bills have separate lists/items/checks. Neither belongs in the catalog.
- Preserve all legacy schemas and migration 0000. Disable legacy routes at the product boundary. No automatic conversion of collections to listings.

## Architecture decisions
Standalone directory tables, normalized links/tags/aliases and managed hierarchical areas. Optional category/area. PostgreSQL numeric prices; both null means unknown, excluded from price-filtered results. Overlap uses open bounds. Tags default to AND. One CatalogSearchService supplies public, admin and bot. Public visibility is `listing.enabled`; taxonomy disable hides navigation/labels, not the listing itself. Public/bot tag flags also apply to search and output. Admin access is explicit at the API boundary. No public accounts.

Search combines PostgreSQL full-text ranking with escaped substring matching for Hong Kong Chinese names and taxonomy/aliases. No separate search engine. Area selection includes descendants. Stable slug lookup uses the same visibility predicate. No public caching of publish state.

## Sequence / status
- Phase 0: audit complete.
- Phase 1: foundation complete.
- Phase 2: admin core complete.
- Phase 3: public web complete.
- Phase 4: shared search complete.
- Phase 5: Telegram implemented; live credentials pending.
- Phase 6: safe CSV import and inventory analytics complete.

## Risks / deployment
Back up PostgreSQL before applying migrations; application rollback requires compatibility testing against the forward schema and reconciliation of writes accepted after deployment. Never run db:push against production. Existing databases must already match migration 0000. Configure DATABASE_URL, APP_BASE_URL, session cookie and Telegram secret/token. Provision an administrator using the bootstrap command that reuses existing authentication; registration will be inaccessible. No seed content is represented as real curated data.

Legacy source and tests remain for later archival/removal; a later migration may drop legacy tables only after explicit data retention review.

### Migration ledger warning from independent audit
Git commit 4360f4a squashed earlier migrations into 0000_initial_schema. Before deploying, inspect each environment's drizzle.__drizzle_migrations ledger. Do not apply the current baseline to an existing database with the old three-migration history. Reconcile ledger/schema against a backup first; this implementation does not alter any deployed ledger. Bills have an optional sharedSpaceId dependency on Spaces. All attrs entered in the new editor are explicitly public metadata.

## Phase delivery reports (2026-09-27)

### Phase 1 — Directory foundation: complete
- Files: `src/db/schema/directory.ts`, `src/schemas/directory.ts`, `src/server/catalog/service.ts`, `src/lib/directory.ts`; runtime schema registered in `src/server/db.ts`.
- Migrations: `0001_directory_catalog` creates standalone listings, normalized links, category/area/tag/group/alias relations, navigation presets and bot storage. `0002_bot_delivery_journal` adds persisted reply operations and delivery progress. `0003_catalog_safe_defaults_indexes` defaults direct inserts to drafts and adds link/FTS indexes. Original `0000_initial_schema` is unchanged.
- Behavior: validated atomic listing writes, optional category/area, multiple same-type links, tag relations, taxonomy CRUD, cycle-safe area edits, numeric range constraints.
- Verification: migrations applied to isolated PostgreSQL 16; integration tests cover CRUD, rollback on invalid FK, relationships, hierarchy cycles and native JSONB storage.
- Limitation: no automatic migration of legacy collection content. Next phase: admin core (completed below).

### Phase 2 — Admin core: complete
- Files: `src/app/(main)/admin/*`, `src/app/api/admin/catalog/*`, `src/components/directory/{AdminCatalog,Editor,ImportPanel}.tsx`, login page, `scripts/create-admin.ts`.
- Schema changes: none beyond Phase 1.
- Behavior: server-side admin gate, existing session/CSRF/rate limits, table and filters, create/edit/delete, explicit Save, unsaved-change warning, link ordering/enable state, public key/value attributes, group/alias/visibility controls, navigation presets. Desktop drawer and mobile full-screen editing. New installation bootstrap reuses existing password authentication.
- Verification: non-admin mutations rejected; admin create/delete API tested against PostgreSQL. Browser flow checks administrator login, create/publish, price, links, attributes and delete. Existing auth tests retained/adapted.
- Limitation: no multi-admin optimistic conflict resolution; last explicit save wins. Next phase: public web (completed).

### Phase 3 — Public web: complete
- Files: public root/main layouts, homepage, `/search`, `/listing/[slug]`, `/categories`, `/tags`, directory card/filter components, `globals.css`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`.
- Schema changes: none.
- Behavior: new light blue/white design, search-first home, concise listing cards, managed navigation, shareable filters, mobile collapsed filters, dynamic external links, metadata/Open Graph. Non-filterable tags display as text. Legacy UI/API routes return 410; source/data retained. Old product browser tests moved unchanged to `e2e/legacy`, excluded from active suite and replaced with retirement assertions.
- Verification: Chromium desktop/mobile checks; public detail/metadata never expose disabled fixture content; 17 active end-to-end tests passed. Fresh visual review disposition SHIP for homepage/admin/editor desktop and mobile; detector returned no findings.
- Limitation: browser coverage run in Chromium only; no live business content supplied. Next phase: shared search (completed).

### Phase 4 — Search: complete
- Files: shared catalog service, public/admin API routes, URL/price helper.
- Schema changes: FTS GIN and link hydration indexes in migration 0003.
- Behavior: one query implementation; Chinese substring plus PostgreSQL FTS, category/tag aliases, tag AND/OR, category, recursive area descendants, HKD range overlap, explicit pagination and sorting. Public/bot visibility centralized; structured filters respect taxonomy visibility/filterability. API query sizes are bounded and public API is rate-limited.
- Verification: real PostgreSQL text/alias/filter/overlap/AND/OR/pagination/disabled tests, URL sharing through Playwright.
- Limitation: Chinese substring searches scan at v1 scale; measure before adding pg_trgm. Price sorting compares numeric amounts without FX conversion. Next phase: Telegram (completed).

### Phase 5 — Telegram: implemented and locally verified
- Files: `src/server/catalog/bot.ts`, rebuilt webhook route/tests; deployment environment documented in README, compose and K3s guide.
- Schema changes: persistent session and update delivery journal from migrations 0001/0002.
- Behavior: configured presets/categories/featured tags, groups, multi-tag selection, category/area/price, free text, results, pagination and available web links. Secret validation fails closed. Callback parsing, eligible ID checks, expired state handling and persisted delivery progress. Short DB planning transaction commits before Telegram network I/O; retries do not replay acknowledged operations.
- Verification: generated buttons, selected tags, result pagination, duplicate updates, expired callbacks, failure/resume, webhook secrets. All Telegram sends mocked; no messages sent to real users.
- Limitations: real bot token/webhook not supplied, so live Telegram acceptance remains a deployment step. A crash after Telegram accepts a message but before progress commits can duplicate that single message (Telegram lacks an idempotency key). Session TTL 24 hours, delivery lease 10 minutes; retention cleanup is an operator task. Navigation menus bound displayed taxonomy rows to 60; result pagination is fully supported. Telegram inline URL buttons use HTTP(S); phone/email links remain available on web details.
- Next phase: CSV/import and basic analytics (completed).

### Phase 6 — CSV and basic analytics: complete for v1 scope
- Files: `src/server/catalog/import.ts`, guarded import API, ImportPanel, admin inventory counts.
- Schema changes: none.
- Behavior: upload/paste, bounded CSV parsing, row validation/preview, explicit confirmation, normalized-name/URL/slug duplicate checks against database and batch, revalidation under a write lock, all-or-nothing draft import. No silent updates. Analytics displays inventory totals only; no behavioral tracking was introduced.
- Verification: quoted/multiline CSV parser tests, malformed input, duplicate preview and confirmation rejection, atomic draft import tests.
- Limitations: CSV supports one website URL per row; use the listing editor for additional links. Up to 200 rows / 500 KB; taxonomy IDs must already exist. Next recommended phase: staging rollout and real catalog population.

## Final validation record
- TypeScript check passed.
- Production build passed with required local test environment.
- Vitest: 103 files, 508 tests passed.
- PostgreSQL integration: 15 tests passed on isolated `hker_directory_test`.
- Playwright Chromium: 17 tests passed; additional desktop/mobile screenshots and admin workflow checked.
- ESLint: zero errors, 16 existing warnings in retained legacy modules.
- `git diff --check` passed.
- Existing JSON serializer double-encoded Drizzle JSON text. Fixed string pass-through and added unit plus raw PostgreSQL `jsonb_typeof` regression checks for attributes, bot state and delivery operations. No legacy schema uses JSON columns; no production catalog data was modified.

## Remaining release work
1. Reconcile each deployed migration ledger using a staging backup; apply only the reviewed additive migrations.
2. Set production environment, preserve existing session secret, bootstrap an admin only for a new installation.
3. Add real taxonomy/catalog content and configure navigation; synthetic fixtures exist only in the isolated test database.
4. Register the actual Telegram webhook with matching secret_token and smoke-test in Telegram.
5. Review dependency audit separately: locked installation reported 17 advisories; dependencies were not upgraded as part of this domain rewrite.
6. Remove legacy source/tables only in a later retention-approved cleanup; current middleware retirement is deliberate and reversible.

## Full hardening continuation

Implemented executor ownership and restrictive taxonomy dependencies; shared OR/preset semantics, explainable aliases/ranking and HKD scope; stable links/revisions/slug aliases; typed searchable CMS; reachable Bot menus and durable runner; mapped multi-link idempotent imports; privacy-filtered aggregate metrics; server retirement and runtime/migration safeguards. Follow the release evidence matrix for actual verification and external blockers. No phase completion statement substitutes for acceptance.
