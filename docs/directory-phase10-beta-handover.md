# Phase 10 release handover and beta exercise

Phase 10 connects the existing directory, Admin, durable Bot worker and migration bundles into one reviewable release path. It does not authorize a real deployment or live Bot test. The authoritative instructions are the [release checklist](directory-release-checklist.md) and [K3s operator runbook](k3s-deploy.md); earlier behavior is recorded in the [Phase 9 RC evidence](directory-phase9-release-candidate.md).

## Status

| Gate | Status | Evidence / boundary |
| --- | --- | --- |
| Implementation | **IMPLEMENTED; LOCALLY VERIFIED** | Candidate image rehearsal, isolated Compose profile, candidate-specific preflight/migration Jobs, doctor, role health, cleanup ledger, Telegram helper and operator runbooks. |
| RC-01..05 prerequisites | **VERIFIED** | Node 24 acceptance: 86/86 integration tests passed, including all five focused regressions. Evidence: `artifacts/release-candidate/acceptance/20260927154247-1fb100/`. |
| Local Phase 10 rehearsal | **LOCALLY VERIFIED** | Latest successful candidate manifest and `deployment-rehearsal.json` are under `artifacts/release-candidate/phase10/`; use the manifest's tree hash and local image ID. Telegram delivery was mock-only. |
| CI | **NOT RUN** | The existing acceptance workflow now runs the isolated candidate rehearsal; a push/PR run is separate evidence. |
| K3s render | **LOCALLY VERIFIED** | Offline JSON-subset YAML generation only; unique `example.invalid` target, no context selected, no `kubectl` call. See generated path printed by `npm run ops:k3s:render`. |
| Staging applied/verified | **NOT RUN** | Requires target authorization, promoted registry digest, reviewed backup/preflight and ingress/network configuration. |
| Live Telegram verified | **NOT RUN** | Rehearsal uses mock only; no API request, webhook registration or message was sent. |
| Real content approved | **NOT RUN** | All Phase 10 rehearsal records are fictional. |
| Independent backup storage / host-loss recovery | **NOT VERIFIED** | Local rehearsal dump is temporary, on the developer host, then removed. |

The current guarded `npm run test:acceptance` passed typecheck, lint, 602/602 unit tests, 86/86 integration tests, fresh/upgrade migration acceptance, production build and 38/38 Chromium tests. Its reports are in `artifacts/release-candidate/acceptance/20260927154247-1fb100/`; each run uses a unique directory so it does not replace older evidence. `npm run ops:rehearsal` then passed against a newly built candidate. It records `candidate-manifest.json`, `deployment-rehearsal.json`, command exit codes, Compose/build logs, `migration-acceptance.log` and runtime-rehearsal evidence beneath the unique `evidenceDirectory`. The manifest records a source-tree/patch and migration fingerprint, Node/platform, local Docker image ID and explicitly null registry digest. A dirty tree is labeled as a local candidate.

## Phase 9 prerequisite reconciliation

| Regression | Current implementation and test evidence | Current-run classification |
| --- | --- | --- |
| RC-01 malformed embedded JSON in imported rows, including skipped rows | `src/server/catalog/import-format.ts`, `src/server/catalog/native-format.ts`; `integration/rc-import.test.ts`. | **Verified in current acceptance** |
| RC-02 blocked chat successors do not starve other chats | `src/server/catalog/bot-delivery.ts`; `integration/rc-bot-fairness.test.ts`. | **Verified in current acceptance** |
| RC-03 hierarchy serialization precedes conflicting area locks | `src/server/catalog/service.ts`; `integration/rc-hierarchy.test.ts`. | **Verified in current acceptance** |
| RC-04 analytics uses the original signed successful-search observation | `src/server/catalog/analytics.ts`; analytics unit, route and `integration/phase8-analytics.test.ts`. | **Verified in current acceptance** |
| RC-05 bounded bulk/export hydration avoids a per-record detail pipeline | `src/server/catalog/service.ts`; `integration/rc-batch.test.ts`. | **Verified in current acceptance** |

The current RC suite was rerun on Node 24 against a disposable loopback `hker_directory_test` database with mock Telegram. It passed 86 integration tests; see the acceptance directory above for full run reports.

## Phase 10 acceptance map

`npm run ops:rehearsal` creates a unique local candidate and three Compose projects. It builds the candidate once, starts an isolated PostgreSQL 16 database, runs the candidate's migration bundle twice to reject stale completion evidence, and refuses a deliberately invalid migration before Web/worker startup. It bootstraps one fictional Admin and confirms a second bootstrap makes no changes. Web and worker have role-specific health; Web is exercised through fictional taxonomy, listings with optional data and repeated links, duplicate-reviewed import, selected export, public discovery, unpublish and wrong/valid-secret mock webhook requests.

The same rehearsal ages synthetic retention records, runs cleanup twice, verifies counts and preserves a locked pending Bot job and an unexpired plan. It checks disabled analytics does not prevent discovery and that the read-only doctor sees cleanup and mock mode. Negative schema readiness keeps liveness 200 while readiness returns 503.

`scripts/rc-runtime-rehearsal.mjs` is run against that exact candidate image. It checks database outage/reconnect without a Web restart storm; takes a PostgreSQL custom-format dump, records its checksum and tool/server versions, restores to a separate disposable database, compares migration ledger and selected catalog/auth/content-plan/Bot-job state, and starts the restored copy. A committed Phase 9 image and synthetic Bot worker then exercise application rollback compatibility against the candidate's forward schema. Finally the candidate worker is stopped while a job is claimed and resumes the stored job without replaying finished work. The temp dump and exact disposable containers/networks are removed. Independent off-host retention and recovery targets remain outside this local evidence.

The active CI workflow remains `.github/workflows/directory-acceptance.yml`. It runs the guarded acceptance suite, optional WebKit, then `npm run ops:rehearsal`; it never deploys remotely. Uploaded evidence excludes private environment files and database dumps and is sanitized before upload.

## Controlled staging gate

1. Review the local candidate manifest and evidence; do not patch it afterward and keep the same local image ID.
2. With explicit staging authorization, push the exact platform image to the approved registry and record its manifest digest. Do not substitute a local image ID or rebuild for staging.
3. Provision separate staging database, runtime/Bot Secrets and ingress/network authentication. Protect staging from general access without blocking the validated webhook route. Confirm HTTPS origin, `__Host-` cookie and proxy overwrite policy.
4. Verify and restore a backup to a separate database. Quiesce writers and worker, review this candidate's migration preflight, then run the K3s `--apply` gate for the exact context/namespace/image/origin. The tool runs preflight, waits, applies migration, waits, and only then applies runtime.
5. Verify readiness, authorized Admin, public search/link flows, publication boundaries, Bot status and an observed cleanup ledger run. If using live Bot delivery, separately authorize the dedicated staging test chat and webhook action.
6. Run a small beta exercise below. Keep all synthetic data clearly labeled and remove/reset only through approved Admin operations.

Do not delete an application namespace to repair a deployment. Do not replay copied SQL, make a hidden connection switch, or restore over the source database as rollback.

## Manual beta scenario

Use only content supplied and approved for the target. Test the Public and Admin pages on desktop and mobile viewports.

| Surface | Scenario | Expected result |
| --- | --- | --- |
| Public | Find an entry by text and alias; open a configured shortcut. | Search remains shareable; only published listings appear; enabled external link opens its destination. |
| Public | Refine by tags and price range, then change an AND/OR preset. | Criteria remain visible and back/pagination returns to the expected search. |
| Public | Search for a deliberate no-result phrase, change the filters and recover. | Empty state is clear and the visitor can adjust or clear filters. |
| Admin | Preview a reviewed import containing an intentional duplicate warning. | Nothing commits until the operator explicitly reviews and chooses the action. |
| Admin | Publish a selected entry, correct an alias, inspect a permitted search gap, export selected entries and unpublish one. | Revision boundaries are respected; unpublishing removes the entry from Public and future Bot results. |
| Telegram | Use only an authorized staging Bot and dedicated test chat. | Shortcut/search flows stay within the test chat; stop after the bounded scenario. Mock all retry/flood failure injection. |

Treat data loss, unauthorized disclosure/mutation, incorrect publication boundaries and broken discovery/Admin primary flows as blockers. Cosmetic issues and ideas stay separate from release blockers; do not open a speculative Phase 11 from optional feedback.

```text
Candidate/image digest:
Surface and viewport:
Steps:
Expected:
Actual:
Impact: blocker | non-blocking
Optional redacted screenshot:
```
