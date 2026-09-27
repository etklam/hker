# Phase 8 — local evidence and operator handover

Status: implementation and verification in progress. This document is not a staging/live release approval.
Baseline inspected: clean working tree, HEAD `44f2263` (newer than assignment inspection reference `251bb2e`). No reset, push, deployment, production data write, secret rotation, webhook registration or real Telegram delivery.

## Phase 7 dependency gate

The seven prerequisites are implemented in HEAD and supported by prior committed isolated evidence. This run re-executes the acceptance suite; only the fresh results below count for this change.

| Prerequisite | Implementation / acceptance evidence |
|---|---|
| Transaction executor propagation | `service.ts`, `integration/concurrency.test.ts`; Phase 8 fixed two new category/group executor regressions found by full integration |
| Shared visibility | `CatalogSearchService`, `publicVisibility`, `integration/hardening.test.ts`, `bot-hardening.test.ts` |
| Search round-trip / OR / price | directory query helpers, preset resolver, search/browser tests |
| Stable child IDs / revisions | shared `saveListingInTransaction`, `integration/hardening.test.ts`, `phase8-content.test.ts` |
| Restrictive taxonomy deletion | service dependency checks and restrictive FKs, catalog/hardening tests |
| Durable Bot dedup / restart | Bot journal, runner and mocked transport integration tests; live Telegram remains external |
| Required fixture acceptance | `scripts/acceptance.mjs` fails without disposable loopback DB + reset authorization; mock delivery enforced |

## Capability map

| Capability | Implementation | Tests / limitations |
|---|---|---|
| Legacy and v2 CSV | `import-format.ts`, `import.ts`; downloadable simple/advanced v2 templates | parser / actual-template unit tests; 200 rows, 500,000 UTF-8 bytes, 24 columns, 24,000 bytes/cell |
| Column / taxonomy mapping | protected import settings, mapping UI, exact slug/path/name/alias resolver | ambiguity and alias unit tests, mapped browser workflow; create unknown terms separately in taxonomy UI |
| Reviewed create/update | `content-plans.ts`, `ImportPanel`, `ContentPlanReview` | selected-row atomicity, lost response, stale revisions, stable child ID and warning decisions integration |
| Recovery | actor-owned UUID plan, 24-hour pending expiry, 7-day completed result | refresh/recovery browser flow; expired plan rejects before mutation; cleanup skips locked commits |
| Bulk | exact ID/revision sets; 200-record cap; page, cross-page and server-frozen matching selection | frozen-target integration; preview includes field differences and no-op counts; no bulk hard delete |
| Portable export | Admin route, explicit selection, repeatable-read snapshot, JSON v1, spreadsheet CSV | JSON fresh-catalog round trip; secrets/operational identities excluded; 500 KB hard rejection |
| History | transaction-scoped Listing/taxonomy/publication/reorder changes, actor and operation references | rollback/replay integration; compact global/per-listing UI; bounded values, not a restore mechanism |
| Measurements | explicit actions, server-authoritative search totals, signed Web receipts, HMAC Bot action keys | dedup, expiry, HK day, suppression, concurrent increments, bounded cleanup and degraded behavior integration |
| Admin discovery | date/source controls, separate inventory/discovery, zero-result denominator, query deletion | UI tests; current-result inspection is a normal result link that emits no submit event |
| Runtime cleanup | existing `ops/analytics-cleanup.cjs` bundles analytics + content cleanup | `ops:build` and disabled-collector cleanup checked; Dockerfile copies `.ops` into runtime |

## Contracts

CSV v2 requires `formatVersion=2` on every row. `categorySlug`, `areaSlug`, `tagSlugs`, `linksJson`, `aliasesJson`, `attrsJson`, Telegram and Instagram columns are versioned additions. Old category/area/tag IDs and old website/links columns remain accepted. Friendly and numeric representations cannot be combined. `linksJson`/`links` cannot be combined with simple link columns. URLs preserve path case, query and fragment. Tags are pipe-separated slugs; arbitrary aliases are JSON arrays. Blank prices are unknown, zero is zero, and amounts use decimal notation with at most two fractional digits. Create currency defaults to HKD; updates retain missing/blank currency.

Update mode matches only an exact current slug. Missing/blank columns retain current content; clearing is selected separately and appears in the diff. Publication, slug and primary ID are unchanged. Append and replace are explicit settings. An authorized child ID must belong to the target; otherwise a unique same-type/same-URL child is retained. Ambiguous child matches require an explicit ID. No fuzzy listing upsert or URL uniqueness rule exists.

Any source/settings/row-decision change requires a new plan. A failed conflict leaves the pending plan available; re-preview before retrying. For a lost response, use “查詢操作狀態” or GET `/api/admin/catalog/operations?id=…`. Retry the same plan ID/digest; do not create another import to guess whether the first committed. Plan IDs are not credentials: actor and Admin authorization are checked. The legacy import API now returns a protected operationId; confirmations require that ID and digest.

Native JSON is `{format:"hker-catalog",version:1,exportedAt,listings,taxonomy}`. Exports include the selected listings, required taxonomy ancestors/groups, and navigation whose criteria fit the exported relationships. Re-import a fresh catalog by explicitly previewing/confirming missing taxonomy, then previewing/confirming listings. Existing same-slug taxonomy is preserved, not overwritten; the operator must reconcile differing definitions. New listings are drafts even if exported enabled. Export is not a full DB backup. Large scopes are rejected rather than truncated; select smaller chunks. Pending payloads are short-lived; committed plans retain only result metadata.

Spreadsheet CSV prefixes formula-like cells (including whitespace/control and Unicode-equivalent prefixes) with an apostrophe and quotes every cell. This intentionally changes the raw text and is not a byte-faithful interchange format or a universal guarantee for all spreadsheet consumers. JSON retains original values. Import never removes that prefix automatically. CSV syntax and escaping are tested; no spreadsheet formulas are executed.

## Measurements and retention

- Search: an explicit text submission whose server search succeeded. Zero-result is its zero-total subset, not backend failures.
- Filter: explicit structured apply/view-results with no text. Kept separate from text search denominator.
- Navigation: eligible preset/tag activation, separate from search.
- Outbound: observed first-party HTTP(S) redirect request, not human click or conversion. Direct Telegram URL buttons cannot be measured. HEAD/prefetch/known previews do not increment.
- Web receipt: signed opaque action ID and server timestamp; ten-minute lifetime, same receipt on retry. Client counts and bot source are rejected.
- Query text: bounded eligible labels only; obvious sensitive/oversized text contributes only to the hidden total. Short eligible terms can still contain personal data. No anonymous-person claim or public suggestions.
- Time: UTC timestamps, Asia/Hong_Kong reporting days, inclusive date bounds; today is partial.
- Retention: pending content 24h, completed results 7d, content history 90d, analytics receipts 7d, aggregates 90 reporting days. Cleanup is bounded/idempotent; run the existing runner repeatedly until counts fall below its batch size.
- Disable via `DIRECTORY_ANALYTICS_ENABLED=false`. Optionally set `ANALYTICS_ACTION_SECRET`; otherwise reuse the existing session signing secret. Do not rotate it casually. Search/navigation do not depend on measurements.
- Degradation is best effort: Admin distinguishes disabled/read failure, but there is no persistent cross-process ledger of every dropped write. Missing data is not evidence of zero demand.
- Admin query deletion removes historical stored term rows; it is not a permanent suppression rule. New genuine searches can appear again.

## Fictional isolated operator walkthrough

1. Use the loopback disposable DB and mock Telegram acceptance fixture. Do not upload the fictional templates to production.
2. Download a v2 template; change its fictional slug, use existing taxonomy slugs, and include two same-type links. Map an ambiguous area explicitly. Skip an invalid row; accept a justified shared-brand warning. Re-preview the exact count, then commit drafts.
3. Refresh and recover the operation. Query status after a simulated lost response; the count and IDs remain the same.
4. In Listing management select two exact rows, review publish/tag changes, then confirm. Verify public search and mocked Bot parity. Unpublish and verify the old stored redirect no longer exposes the link.
5. Preview an update; edit a target elsewhere. Confirm must conflict with no sibling writes. Re-preview, inspect links/blank fields, and commit.
6. Submit permitted zero-result Web/Bot searches. Inspect source/date totals. Add an alias through the existing editor, inspect current results, then submit again. Old zero-result observations remain historical.
7. Export selected JSON, preview its missing taxonomy in an empty isolated catalog, then create draft listings. Compare relationships/aliases/links and price values, allowing new IDs/revisions.
8. Run cleanup with telemetry disabled. Prepare a DB backup/restore rehearsal before any authorized rollout. Reverting application code must be tested against forward migrations; history does not provide safe automatic undo.

## Verification ledger

Fresh execution logs live in `/private/tmp/hker-phase8-*.log`. Final counts and screenshot review are appended after completion. Early runs deliberately exposed and then fixed the Zod refinement/omit issue, JSONB key-order digest issue, taxonomy executor self-lock, and an E2E label selector issue.

External staging/live gates remain: deployed migration ledger reconciliation against a backup, real content ownership, HTTPS/proxy configuration, scheduler operation, authorized Telegram chat/webhook, deployment and restore rehearsal. No local test implies those passed.
