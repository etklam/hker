# Phase 7 extended acceptance evidence

Date: 2026-09-27. This document covers the extended Phase 7 brief against the current working tree. `PRODUCT.md` remains authoritative. No production database, webhook, Telegram chat or deployment was used.

Status vocabulary is deliberately separated:

- **CODE COMPLETE**: implementation and regression coverage exist in the working tree.
- **LOCALLY VERIFIED**: the cited focused check or earlier local acceptance evidence passed against the disposable loopback database. The final aggregate command passed on the final implementation, with counts recorded below.
- **STAGING VERIFIED**: requires the ordered staging procedure below. It is not implied by local evidence.
- **LIVE VERIFIED**: requires an authorized dedicated Telegram chat and production-like operations. It is not implied by mocks or staging.

Current phase status: **CODE COMPLETE**; focused checks are **LOCALLY VERIFIED**. Final aggregate evidence: **LOCALLY VERIFIED**, exit 0. Staging and live statuses: **not verified**.

## B01–B10 defect register

| ID | Reconfirmed defect | Disposition | Code and regression target |
|---|---|---|---|
| B01 | Bot transaction helpers could reacquire the global pool. | Historical defect, fixed and retained. | `src/server/catalog/bot.ts`, `src/server/catalog/service.ts`; `integration/concurrency.test.ts`, `integration/bot-hardening.test.ts`. |
| B02 | Import preview could leave its owning transaction. | Historical fix retained; extended work adds actor-bound explicit operation keys, replay receipts and commit-time taxonomy revalidation. | `src/server/catalog/import.ts`, import API route; `integration/concurrency.test.ts`, `integration/import-analytics.test.ts`. |
| B03 | Taxonomy deletion could silently broaden presets. | Historical fix retained; extended work adds locked dependency validation, placement visibility checks and explicit broad-preset intent. | `src/server/catalog/service.ts`, `src/lib/directory-presets.ts`, migration `0004`; `integration/hardening.test.ts`. |
| B04 | Web submission lost OR semantics and Bot copy misstated it. | Historical fix retained and extended through canonical URL state, preset resolution and Bot state migration. | `src/lib/directory.ts`, `SearchForm.tsx`, `bot.ts`; unit, integration and browser search cases. |
| B05 | Default sorting and ranking did not model exact/alias matches. | Historical fix retained; extended deterministic tiers, normalized aliases and explicit automatic-sort intent. | `src/schemas/directory.ts`, catalog service; directory unit and hardening integration tests. |
| B06 | Listing save recreated links and allowed silent stale writes. | Historical fix retained; extended real two-tab browser conflict, session-expiry draft recovery and stale Admin-response protection. | catalog service, `Editor.tsx`, `AdminCatalog.tsx`; admin/hardening integration, component and E2E tests. |
| B07 | Bot menus truncated eligible taxonomy. | Historical fix retained; extended group/page navigation and bounded rendering. | `bot.ts`; `integration/bot-hardening.test.ts`. |
| B08 | `all` and `/all` did not fully reset and browse. | Historical fix retained; exact command parsing and state assertions cover it. | `bot.ts`; Bot transport/unit and hardening integration tests. |
| B09 | Delivery errors lost retry data and recovery depended on inbound traffic. | Historical fix retained; extended transport classification, leases, durable runner, restart recovery and publication recheck. | `bot-delivery.ts`, `bot-transport.ts`, runner; transport and Bot integration tests. |
| B10 | Required E2E could pass while directory fixtures were skipped. | Historical fix retained; guarded acceptance and fixture setup fail closed. | `scripts/acceptance.mjs`, `scripts/e2e-fixture.ts`, Playwright configuration and CI workflow. |

## Mandatory requirement matrix

All rows are **CODE COMPLETE**. “Local evidence” names the executable evidence; all cited suites passed in the final aggregate run.

| ID | Behavior | Actual implementation | Local evidence |
|---|---|---|---|
| DB-01 | Pool-size-one transactional path completes. | Explicit `CatalogExecutor` propagation and transaction owner. | `integration/concurrency.test.ts`. |
| DB-02 | Small-pool concurrent work completes. | Bounded Bot/import transactions and short delivery claims. | `integration/concurrency.test.ts`, `integration/bot-hardening.test.ts`. |
| DB-03 | Parent/child failure rolls back. | Listing/import writes share one transaction. | `integration/concurrency.test.ts`, `integration/catalog.test.ts`. |
| DB-04 | Failure releases locks/connections. | Local timeouts, `finally` pool close and post-failure reuse. | `integration/concurrency.test.ts`. |
| TAX-01 | Referenced taxonomy deletion conflicts. | Locked final impact check plus restrictive FKs. | `integration/hardening.test.ts`, catalog integration. |
| TAX-02 | Preview/delete race cannot bypass protection. | Final transaction row lock and dependency recheck. | `integration/hardening.test.ts`. |
| TAX-03 | Disabled criteria invalidate without broadening. | Shared audience-aware preset resolver. | `src/lib/directory-presets.test.ts`, hardening integration. |
| TAX-04 | Area cycles fail safely. | Cycle validation and terminating hierarchy ordering. | `integration/catalog.test.ts`, directory unit tests. |
| SEARCH-01 | OR survives submit/refresh/page. | Canonical parse/serialize and explicit preset expansion. | `src/lib/directory.test.ts`, `SearchForm.test.tsx`, directory E2E. |
| SEARCH-02 | Automatic and explicit sorts differ. | `requestedSort` separated from resolved `sort`. | directory schema/unit and Bot integration tests. |
| SEARCH-03 | Exact Chinese/name/alias wins. | Deterministic search tiers and stable tie-break. | `integration/hardening.test.ts`. |
| SEARCH-04 | Hidden tags do not match aliases. | Audience predicates apply to tag and alias joins. | catalog/hardening integration. |
| SEARCH-05 | Invalid IDs never broaden. | Shared restrictive resolver returns invalid-search state. | directory unit, catalog and Bot integration tests. |
| SEARCH-06 | Web/Bot order is equivalent. | Shared search service and ranking tuple. | `integration/hardening.test.ts`. |
| SEARCH-07 | Price overlap/open/unknown/currency is correct. | Numeric validation and HKD-scoped filtering/sorting. | catalog/hardening integration. |
| SEARCH-08 | Boundaries, empty pages and ties are honest. | Bounded paging and stable order. | catalog integration and directory/admin E2E. |
| EDIT-01 | Two tabs yield success plus conflict. | Revision-checked parent update. | `integration/hardening.test.ts`; real two-tab case in `e2e/admin-directory.spec.ts` passed in the final browser run. |
| EDIT-02 | Losing draft/children remain intact. | Parent revision check precedes child diff; editor retains state. | hardening integration, `Editor.test.tsx`, admin E2E. |
| EDIT-03 | Retained/new/removed links behave correctly. | Ownership-checked in-place link diff. | catalog/hardening integration and admin E2E. |
| EDIT-04 | Foreign child IDs are rejected. | Parent ownership validation inside transaction. | `integration/hardening.test.ts`. |
| EDIT-05 | Name edit does not silently change slug. | Slug is explicit; old slugs are reserved/redirected. | hardening/admin integration and browser flow. |
| EDIT-06 | Old Admin responses are ignored. | Abort plus active-request identity guard. | `AdminCatalog.test.tsx`. |
| BOT-01 | `all` and `/all` clear all filters. | Exact reset transition. | `integration/bot-hardening.test.ts`. |
| BOT-02 | Similar words/unknown commands are safe. | Anchored command parser. | Bot transport unit and hardening integration. |
| BOT-03 | Later taxonomy pages are reachable. | Bounded page callbacks for all taxonomy/presets. | `integration/bot-hardening.test.ts`. |
| BOT-04 | Group/back/remove/clear preserve meaning. | Persisted group/page and explicit transitions. | `integration/bot-hardening.test.ts`. |
| BOT-05 | Duplicate update cannot toggle twice. | Update receipt deduplication. | catalog and Bot integration. |
| BOT-06 | Wrong-user/expired/malformed/stale callbacks are safe. | User/session nonce, message binding and expiry checks. | Bot integration and transport unit tests. |
| BOT-07 | Maximum valid input stays within limits. | Unicode-safe text and 64-byte callback bounds. | Bot integration and transport unit tests. |
| BOT-08 | Unsupported/missing links make no invalid buttons. | Renderer emits only eligible HTTP links; detail remains available. | catalog/Bot integration. |
| DELIVERY-01 | Completed duplicates do not resend. | Durable status/progress receipts. | `integration/bot-hardening.test.ts`. |
| DELIVERY-02 | Throttle delay holds no DB connection. | Transport happens outside short claim transactions. | Bot delivery integration and transport tests. |
| DELIVERY-03 | Permanent/transient failures diverge safely. | Typed Telegram errors and bounded retry schedule. | `bot-transport.test.ts`, Bot integration. |
| DELIVERY-04 | Lease has one owner; stale owner cannot release. | Owner-qualified claim/progress/release. | `integration/bot-hardening.test.ts`. |
| DELIVERY-05 | Restart resumes without inbound traffic. | Runnable pending-job recovery loop. | Bot integration and `scripts/bot-runner.ts`. |
| DELIVERY-06 | Conversation ordering survives retry waits. | Chat lease and ordered claim. | `integration/bot-hardening.test.ts`. |
| DELIVERY-07 | Unpublish-after-plan blocks stale rendering. | Publication digest rechecked before every attempt. | `integration/bot-hardening.test.ts`. |
| DELIVERY-08 | Cleanup preserves active/dedup state. | Retention predicates exclude active leases/work. | Bot integration and runner cleanup path. |
| IMPORT-01 | Changed input invalidates confirmation. | Preview digest plus transaction revalidation. | `integration/import-analytics.test.ts`. |
| IMPORT-02 | Concurrency/rollback/lost response are safe. | Actor-bound operation key, receipt replay and atomic transaction. | import/concurrency integration. |
| IMPORT-03 | Imports remain drafts and never overwrite. | Create-only rows force `enabled=false`; duplicates require decisions. | import integration and admin E2E. |
| SEC-01 | Auth/CSRF failures reject mutations. | Admin wrappers and exact-origin validation. | catalog/security integration and API E2E. |
| SEC-02 | Disabled/private data stays out of public surfaces. | Public DTO and shared visibility predicates. | catalog/hardening integration and directory/API E2E. |
| SEC-03 | Oversize/invalid/unsafe input fails safely. | Bounded JSON/CSV bytes, Zod limits and URL type/scheme checks. | parser/import/schema/transport tests. |
| UI-01 | Admin create/edit/publish/unpublish works. | Admin catalog, editor and atomic APIs. | `e2e/admin-directory.spec.ts`. |
| UI-02 | Public filters/detail/outbound navigation work. | Shared state, public DTO/detail and enabled outbound resolver. | directory/API E2E and import analytics integration. |
| UI-03 | Responsive/focus/error/dirty states are usable. | Modal focus return, unsaved warning, mobile layout and recovery copy. | editor component tests, admin/visual E2E; screenshots captured and inspected as recorded below. |
| OPS-01 | Fresh and supported upgrade migrations work. | Forward migrations `0000`–`0006` and guarded rehearsal. | `scripts/migration-acceptance.mjs`; fresh and upgrade rehearsals passed. |
| OPS-02 | Image starts and operator commands exist. | Docker/runtime validation, migration/admin/Bot scripts. | final production image smoke passed; see digest and commands below. |
| OPS-03 | Acceptance cannot silently skip fixtures. | URL/reset guard, mandatory fixture and no-skip Playwright path. | `scripts/acceptance.mjs`; negative guard rejected missing setup and final run passed with zero skips. |

## Import operational notes

- CSV remains the existing preview/confirm contract: maximum 200 data rows and 500,000 UTF-8 bytes, with bounded columns and individual fields. Imports create unpublished Listings only.
- Confirmation requires a browser-generated operation UUID. The stored receipt key is scoped to the authenticated actor; its fingerprint includes mode, CSV, preview digest and row decisions. Retrying the same operation returns the established result. Reusing a key with different content or decisions conflicts.
- Parsing is outside the transaction. Database-dependent taxonomy, slug, name, URL and relationship checks run again through the transaction executor after the catalog advisory lock. Any invalid row aborts the whole selected batch.
- Disabled or removed taxonomy invalidates confirmation. Duplicate names/shared URLs remain warnings because they can represent legitimate branches; the Admin must explicitly accept or skip those rows. A later intentional import uses a new operation key.
- The template is static and error output is rendered in the Admin UI; no user-controlled CSV error export is produced. Advanced multi-link formats beyond the existing JSON cell contract remain out of scope.

## Migration and rollback boundary

Migrations are forward-only and additive through `0006_rapid_sebastian_shaw.sql`; earlier migration files and ledger history must remain unchanged. Before deployment, run the ledger preflight against the target and stop on an unfamiliar ledger, unexpected schema or unreviewed pending migration.

An application rollback is safe only if the older application is confirmed compatible with the additive columns, constraints and new job states. Do not run automatic down-migrations or rewrite the Drizzle ledger. Restoring a pre-deployment backup is a data-loss operation for every write after that backup; preserve and reconcile post-deployment writes before choosing it. Constraint/index rollback can also require locks and a separate reviewed forward migration. The default response to a failed rollout is to stop traffic-changing steps, retain the database, inspect the migration/application compatibility and deploy a reviewed forward fix.

## Ordered staging and live runbook

1. Record the reviewed commit/image digest, Node 24 runtime, operator, change window and rollback owner. Run `npm run db:preflight` with the staging runtime environment and record the migration ledger without printing secrets.
2. Create the approved database backup and record its encrypted location and retention. Restore it into an isolated database, run integrity checks and confirm the restore is usable before relying on it.
3. Configure staging runtime secrets through the deployment secret store: database URL, session secret, public HTTPS URL, Telegram token/webhook secret and dedicated test chat. Do not paste secret values into logs or this document.
4. Apply the reviewed forward migrations with `npm run db:migrate:safe`. Re-run preflight; stop if applied/pending migrations differ from the reviewed set.
5. Start the production image as its non-root user. Verify liveness, readiness, database diagnostics, public browse and Admin authentication separately.
6. Through Admin, create clearly labelled staging-only taxonomy, a draft Listing, decimal price range, multiple link types and both restricted and explicit-broad presets. Publish only the controlled staging Listing.
7. Verify Web automatic/manual sorting, Chinese/alias matching, OR filters, price overlap, pagination, share/refresh/back behavior, detail links and unpublish. Confirm disabled/invalid preset criteria never broaden.
8. Start the durable Bot runner using the documented runtime command. Check runner heartbeat, pending/retry/terminal queue state and sanitized logs before registering a webhook.
9. Only with explicit authorization, register the dedicated staging webhook with its secret and verify the reported webhook target/status. Do not register or replace a production webhook during staging acceptance.
10. In the authorized dedicated chat, test `/start`, `/all`, ordinary text, all menu pages, groups, callback ownership, stale callbacks, website-only/no-link results and an OR preset. Record Telegram evidence separately from mock evidence.
11. Inject a temporary retryable failure, stop/restart the runner and verify lease recovery, ordering, acknowledged-operation progress and unpublish-before-retry behavior without another inbound message.
12. Review sanitized errors, query/resource measurements, staging fixture cleanup, queue retention and the rollback decision tree. Remove or clearly isolate synthetic records. Mark **STAGING VERIFIED** only after every applicable step passes.

Production rollout is a separate authorized action. **LIVE VERIFIED** additionally requires the approved production-like webhook/chat exercise, scheduler observation and recovery evidence. Mock transport, local Chromium and staging checks do not satisfy it. No production action was performed for this phase.

## Final executed evidence

Local acceptance used Node **24.21.0**, PostgreSQL **16.15**, a disposable database `hker_directory_test` on loopback port 55439, and Chromium. Benchmark execution separately used Node **24.15.0**, as recorded in its raw report. Both are Node 24; neither used the host default Node 26.

Locked packages inspected: Next 15.5.26, React 19.3.0, drizzle-orm 0.45.3, postgres 3.4.9, TypeScript 5.9.3, drizzle-kit 0.31.11 and direct esbuild 0.28.2.

The extended-request baseline `npm run test:acceptance` exited **0** with 535 unit / 50 integration / 30 Chromium cases. It covered the already-dirty working tree, not a clean-HEAD assertion. The final command was:

```sh
PATH=/tmp/hker-node24/node_modules/node/bin:$PATH \
DATABASE_URL=postgres://postgres:directory-test@127.0.0.1:55439/hker_directory_test \
ALLOW_DIRECTORY_TEST_RESET=1 npm run test:acceptance
```

| Final check | Outcome | Failed / skipped |
|---|---|---|
| Aggregate `test:acceptance` | Exit 0 | 0 / 0 |
| Typecheck | Passed | 0 errors |
| ESLint | Passed | 0 errors, 16 inherited legacy warnings |
| Unit tests | 547 passed, 113 files | 0 / 0 |
| Isolated integration | 60 passed, 8 files | 0 / 0 |
| Migrations | Fresh 7 migrations; baseline 0000–0003 upgraded to 7; Listing/link IDs retained | 0 failures |
| Production build | Passed | 0 failures |
| Chromium E2E | 34 passed | 0 / 0, no flaky retries |
| Missing-setup guard | Expected exit 1 before DB access | No unexpected failure |
| Production npm audit | Exit 0, no advisories | 0 |
| Full npm audit | Exit 1, 4 moderate development-chain entries | 0 high/critical |
| Final Docker build / smoke | Passed | 0 failures |
| `git diff --check` | Passed | 0 |

Preserved failed invocations: an early new unit assertion expected undefined for a blank price, while the existing canonical contract uses null (corrected assertion; focused 10/10 passed). The first extended aggregate passed all non-browser stages but finished **32 browser passed / 2 failed**: the two-tab test used an implicit label whose textarea contents changed the locator; the home-state test sent PostgreSQL numeric strings to the numeric mutation schema. Corrected test locator and fixture serialization; focused browser 9/9 passed, then the entire final aggregate passed 34/34. Temporary concurrent-edit typecheck/ops-build failures during agent development were resolved before acceptance. None is counted as a successful run.

Raw logs and the reproducible image smoke script are retained under ignored `.impeccable/review/phase7-extended/`, including baseline, first aggregate failure, final aggregate, focused browser, image build/smoke, audits, negative guard and benchmark JSON. No production secrets are included.

The final image is `hker:phase7-extended`, SHA-256 `878de50a38ca7f7975c6ce73460cb2eba4dd0bbdba9433879355ffe5e647b98a`, running as `node`. Image-contained `ops/migrate.cjs --apply` plus repeat preflight, `ops/create-admin.cjs`, mock `ops/bot-runner.cjs`, `--status`, and `--cleanup --batch 10` all succeeded. No Bot token was configured. Home/health/ready returned 200; retired marketplace API returned 410. A second container pointed at an unavailable DB returned health 200 and ready 503. The synthetic image database and both smoke containers were removed; unrelated running containers were left unchanged. This image was built from the final runtime code, before documentation-only evidence updates.

The full audit's moderate chain comes from drizzle-kit's nested older esbuild. The upstream [esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99) concerns its development server. The production audit is clean; no forced dependency update was used, and the runtime image does not carry drizzle-kit development tooling.

## Visual and performance evidence

24 actual browser screenshots were captured at **390 / 768 / 1440 px**, covering home, search, detail, Admin table, editor, empty search, invalid search and long detail content. Paths: `.impeccable/review/release/{public,search,detail,admin,editor,empty,invalid,long}-{390,768,1440}.png`. Inspected home/Admin mobile, desktop search/editor, mobile editor/empty/long detail and tablet invalid state: no horizontal overflow, modal controls remain usable and synthetic content is visibly test-labelled. Chromium viewport emulation is not real-device, Firefox or WebKit certification.

[Performance observations](directory-performance-observations.md) records 3,000 synthetic Listings, 240 tags, 48 areas, 6,000 links, 30 warm samples per path, and 48 mixed operations across eight concurrent clients. Zero measured errors. Warm p95 was 487.79 ms for Chinese search and 475.65 ms for alias search; mixed concurrent p95 was 1,727.84 ms. Correlated matching and sequential scans remain a measured scaling risk. The query-budget regression caps search at 7 and detail at 5 queries and verifies constant query count from one to twelve cards. This is exploratory local evidence, not a capacity or production-latency promise.

## Additional defects found during extended implementation

| ID / severity | Reproduction and correction | Regression |
|---|---|---|
| E01 / medium | `audience=public&audience=admin` or conflicting status values previously took the first value; reject conflicting scalar duplicates. | directory unit |
| E02 / medium | `preset=1&q=` could drop preset restrictions; blank optional values no longer replace a preset. | directory unit |
| E03 / medium | Enabling navigation through the publication shortcut bypassed save validation; shared validation now also protects this path. Broad navigation must be explicitly confirmed in the editor. | hardening integration |
| E04 / medium | Public API exposed internal row fields through spread hydration; explicit public DTO excludes revision, status, ordering and internal child fields. | API E2E |
| E05 / medium | Runner could spin on due-but-unclaimable work, or expire another worker's active lease; bounded waiting and DB-clock lease predicate added. | Bot integration / runner code |
| E06 / low | Empty featured results looked like an empty catalog and out-of-range page fractions were misleading; recent fallback, genuine-empty copy and return-to-first-page recovery added. | home-state/directory E2E |

Historical B01/B02/B03/B06/B09 are high-severity integrity/reliability hypotheses retained as regression coverage; B04/B05/B07/B08/B10 are medium severity. Their reproduction targets are the named behavioral tests above. They were already addressed in the initial extended baseline and are not claimed as newly reproduced production incidents.

## Readiness conclusion

Evidence supports **local beta readiness** for the defined directory workflows. Staging HTTPS/proxy/session settings, actual backup restoration, scheduler monitoring, production ledger review and dedicated live Telegram acceptance remain **externally unverified**. No production deployment, webhook registration or real-user messaging occurred. Advanced import formats and behavioral analytics remain outside this phase; retained legacy code is not an acceptance claim for those features.
