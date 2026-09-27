> Latest extended Phase 7 evidence: [extended acceptance matrix](directory-phase7-extended.md) and [performance observations](directory-performance-observations.md). Earlier counts below are historical; the extended final aggregate passed 547 unit / 60 integration / 34 Chromium tests with zero skips. Staging/live gates remain open.

# Phase 7 — correctness and beta acceptance

Date: 2026-09-27. HEAD: `251bb2e3b5ffb660ab14d6dcbf0809a4ef4a3c60`.

The checkout had extensive uncommitted hardening before this request. It was preserved and reviewed; no reset, migration-ledger rewrite or production database access occurred. The initial full acceptance rerun passed before the additional fixes below. Prior release-matrix counts are historical evidence, not this run's results.

## Defect-to-code and regression checklist

| Requirement | Implementation and regression evidence |
|---|---|
| Transaction executor ownership | [service](../src/server/catalog/service.ts), [import](../src/server/catalog/import.ts), [bot](../src/server/catalog/bot.ts): explicit executor throughout transaction calls. [Concurrency integration](../integration/concurrency.test.ts) covers max=1 completion, invalid write rollback, statement timeout and connection reuse; max=2 concurrent Bot/import work. Pools close in finally with bounded tests. |
| Restrictive taxonomy deletion | [0004 forward migration](../drizzle/0004_zippy_romulus.sql), service dependency counts and row lock; [hardening](../integration/hardening.test.ts), [catalog](../integration/catalog.test.ts). Disabled taxonomy hides labels/navigation without unpublishing listings; group visibility controls group presentation, individual tag visibility controls tags. Invalid preset criteria are rejected. |
| Shared OR/filter state | [shared helpers](../src/lib/directory.ts), [SearchForm](../src/components/directory/SearchForm.tsx), schema; unit round trips and [browser OR/history flow](../e2e/admin-directory.spec.ts). Public audience overrides are rejected. Presets become editable explicit filters; pagination preserves them. |
| Meaningful ranking | Service exact name, exact alias/tag, partial name, partial alias/tag tiers, then FTS/manual/ID; Chinese substring remains supported. New adverse-sortOrder regression in hardening proves partial aliases beat incidental description text, explicit manual wins, and page two is stable. |
| Price ranges | Catalog/hardening integration covers zero, unknown/open/inclusive overlap, decimals and HKD scope; foreign currencies remain displayable. |
| Admin atomic edits | Service revisions and child-ID ownership; hardening/admin integration and actual browser create/edit/publish. Stale 409 keeps draft and child identities. Admin fetch abort guard preserves newest response. New browser regression verifies deletion of final page item returns to a valid page while retaining filters. |
| Bot commands and reachable menus | Bot persisted tag-group/page context, anchored command parsing and explicit sort tracking. [Bot integration](../integration/bot-hardening.test.ts) uses 85 tags, 85 areas and 20 presets, group select/toggle/page, OR text, exact all and unknown slash commands. Set `TELEGRAM_BOT_USERNAME` for addressed-command filtering. |
| Bounded replies / ownership | Bounded final text, Unicode-safe truncation, callback byte validation, session/user nonce and expiry. Existing long-label and cross-user tests retained. Website/no-link results remain supported. |
| Durable delivery | [delivery runner](../src/server/catalog/bot-delivery.ts): short claim transactions, owner-qualified progress/release, ordered recovery, retry/terminal journal, visibility recheck and retention. [Transport](../src/server/catalog/bot-transport.ts) now retains numeric errorCode, description and retryAfter, with narrow missing/uneditable-message fallback. [Transport tests](../src/server/catalog/bot-transport.test.ts) prove 429/permanent/network handling and fallback boundaries; Bot integration covers restart/concurrent claims/old ownership. |
| Deterministic acceptance | [acceptance command](../scripts/acceptance.mjs) validates loopback disposable DB/reset opt-in, migrates, fixtures and production browser. [Integration safety](../integration/safety.ts) also rejects remote URLs for direct integration runs. Required mode cannot silently skip setup. |
| Visibility and server protection | Catalog/admin/security integration; public detail/metadata and API browser checks. Retired route server guards, CSRF exact origin, bounded JSON and rate controls retained. |
| Migration/image/operations | Forward 0004/0005 retained; immutable 0000–0003 unchanged. [Migration rehearsal](../scripts/migration-acceptance.mjs) covers fresh and supported baseline upgrade. [Release procedure](directory-release-checklist.md) documents backup, preflight, bootstrap, restore and live gates. |

## Additional fixes in this pass

1. Partial alias/tag ranking was previously tied with incidental description matches. The new PostgreSQL regression failed before the tier correction and passed afterward.
2. Telegram transport previously discarded error code/description and failed permanently on missing editable messages. Two new unit checks failed before correction and passed afterward. Retry timing now honors the server-provided delay without shortening it to one hour.
3. Bot group/page context, exact slash-command parsing and explicit newest sort preservation were missing despite earlier completion claims; focused integration passed after correction.
4. Admin page reconciliation and detail screenshots were absent from previous acceptance; added targeted browser coverage.
5. Added explicit one-connection rollback/timeout coverage and a loopback safety guard for direct integration execution.
6. Final review tightened callback admission to the current saved Telegram message ID, reset explicit-sort state after preset replacement, and rejected public admin-status / malformed comma-separated tag filters. Added mobile draft/error/empty-state and actual unpublish coverage.
7. Public forms now retain an explicit automatic-sort choice: a browse form no longer accidentally submits its resolved manual default as a user-selected sort. Automatic URLs/filter removal/pagination retain this distinction; explicit newest/manual choices survive query edits. The browser exercises both paths.

## Executed evidence

All database operations use disposable PostgreSQL 16 at loopback port 55439, database `hker_directory_test`. Node 24 is supplied by `/tmp/hker-node24/node_modules/node/bin`; the host default is Node 26 and was not used for acceptance.

Initial dirty-worktree baseline: `npm run test:acceptance` exited 0; typecheck, lint (0 errors/16 inherited warnings), 534 unit tests, 45 integration tests, fresh/upgrade migration rehearsal, production build and 26 Chromium tests passed, no skipped tests. This is the actual checkout baseline, not an assertion about clean HEAD.

Focused regressions: transport red run 2 failed/3 passed, ranking red run 1 failed/5 passed; corrected unit subset 10 passed, transaction/ranking integration subset 8 passed, Bot subset 12 passed. These deliberate red runs are not counted as final failures or hidden.

Final results (executed, not copied from prior documentation):

| Check | Passed | Failed | Skipped / notes |
|---|---:|---:|---|
| Typecheck | yes | 0 | 0 |
| Lint | yes | 0 | 16 inherited legacy warnings |
| Unit (`npm test -- --maxWorkers=4`) | 535 | 0 | 0; 111 files |
| Isolated PostgreSQL integration | 50 | 0 | 0; 7 files |
| Fresh / baseline 0000–0003 upgrade migration rehearsal | 2 scenarios | 0 | 0; six migrations, IDs/data retained |
| Production build | yes | 0 | 0 |
| Final Chromium (`npm run test:e2e -- --project=chromium --workers=1 --reporter=list`) | 30 | 0 | 0 |
| Docker production build | yes | 0 | Image `hker:phase7-acceptance`, sha256 `403a885f7cd8e0ab31ae5e3b66744afae3dbb262eef31921c7a93943ce242aed` |
| Image startup / operations | yes | 0 | Nonroot; home/health/ready/automatic search 200, retired API 410; migrate apply and repeat preflight, admin bootstrap and mock drain succeeded |
| Required-setup negative check | expected rejection | 0 unexpected | Missing test URL/reset opt-in exits 1 before any DB operation |
| `git diff --check` | yes | 0 | 0 |

The last aggregate `test:acceptance` invocation passed all non-browser stages but exited 1 with browser 28 passed / 2 failed. Both failures were test locator defects: a label query included hidden Next streaming DOM, and an exact label-text query did not identify the select's accessible name. Only the test selectors changed afterward; the complete Chromium suite then passed 30/30 on the same production build. Earlier aggregate runs exited 0 (26, 27 and 29 browser cases before the final additions). No failed invocation is represented as a successful aggregate run.

Raw local logs are retained under ignored `.impeccable/review/phase7/`: `initial-acceptance.log`, `final-checks-and-browser-failure.log`, `final-browser.log`, `final-image.log`, dependency audit JSON and deliberate red-test logs. Screenshots are under `.impeccable/review/release/{public,search,detail,admin,editor}-{390,768,1440}.png`.

Dependency audit executed in this pass: production audit exited 0 with zero advisories; full audit exited 1 with four moderate entries in the inherited drizzle-kit/esbuild development-tool chain, zero high/critical. No forced upgrade was applied. Runtime image excludes these development tools.

Visual acceptance: actual home/search/detail/Admin table/editor screenshots at 390 and 1440 pixels inspected, with additional 768-pixel browser checks. The initial Admin capture caught loading rather than table data; the test now waits for the fixture row before capture. Modal captures use viewport size, avoiding full-page screenshots of inert background below the modal. No blue/white redesign was performed. Mechanical UI detector returned no findings. This is Chromium emulation, not real-device or Firefox/WebKit certification.

## Scope and release gates

Advanced import formats and behavioral analytics remain backlog/outside this phase. Their inherited uncommitted code was preserved; inventory counts are not claimed as search analytics acceptance. No new domain or infrastructure was introduced in this pass.

Staging credentials, actual production ledger/backup rehearsal, HTTPS/proxy/scheduler validation and authorized dedicated live Telegram chat remain external gates. No live webhook registration, real-user message or production deployment occurred. Mock delivery cannot prove Telegram acceptance. A crash after remote acceptance but before the local journal commit may duplicate a message; this is not exactly-once delivery.

References: [Telegram error response contract](https://core.telegram.org/bots/api#making-requests), [retry_after](https://core.telegram.org/bots/api#responseparameters). Runtime dependencies were audited without forced upgrades; remaining development-tool advisories are recorded with final results.
