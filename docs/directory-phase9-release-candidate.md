# Phase 9 release candidate

> Historical Phase 9 report. The current deployment path and acceptance status are in the [Phase 10 handover](directory-phase10-beta-handover.md). Phase 10 adds migration `0009_phase10_maintenance_runs`; the Phase 9 migration statements below describe the code at that earlier checkpoint.

This report supersedes Phase 7/8 local counts, without certifying a deployment. The reviewed baseline is `d5aaa1944ddf0689aa00be249741f2a763744986`. Its [GitHub acceptance run 36314293368](https://github.com/etklam/hker/actions/runs/36314293368) was independently checked as successful. A replacement candidate requires its own completed CI run; the baseline pass does not certify these changes.

## Finding register

| ID | Reproduction and change | Evidence |
| --- | --- | --- |
| RC-01 | Malformed update-row JSON escaped the preview catch. One typed interpretation now carries field presence, parsed values and row errors through preview, merge and commit validation. Explicit exclusion preserves the invalid target; native records are validated independently of their envelope. | `rc01-before.log`, `rc-content-final.log`; RC import HTTP/UI tests |
| RC-02 | A delayed Chat A head plus 150 successors starved B/C. Candidate selection now finds eligible chat heads before its limit and rechecks ownership when claiming. B/C complete in the first iteration; after clock advance A completes in ordered batches of 100 and 51. | `rc02-before.log`, `rc02-after.log`, `rc02-query-plan.txt`; fairness suite |
| RC-03 | Explicit barriers reproduced row-lock timeout/deadlock (55P03/40P01). Area writes, publication and deletion acquire hierarchy serialization before rows. | `rc03-before.log`, `rc03-after.log`; hierarchy suite |
| RC-04 | Event ingestion could observe a different catalog than the displayed search. A purpose/version/source-bound, expiring HMAC observation authenticates the actual result count and criteria digest. Ingestion never reruns search; replay increments once. | analytics unit, route and integration tests |
| RC-05 | Per-record detail hydration amplified bulk/export queries. Internal Admin batch hydration and repeatable-read snapshots now fetch bounded sets; update-import target lookup uses the same interface. | `rc01-after-rc05-before.log`, `rc05-statements.json` |

Listing deletion also requires the current revision and records bounded transactional before-values with actor, children and former slug reservations. Taxonomy deletion records history. Existing plan ownership, digest, revision and lost-response protections remain in force.

## Concurrency and privacy contracts

Logical lock order is catalog namespace `724111` → area hierarchy `724110` → affected rows. Single area operations need only hierarchy → row; native taxonomy import holds namespace first. Validation and writes share the transaction executor. Independent taxonomy metadata does not acquire the area hierarchy lock. Bounds/timeouts remain in place. This follows PostgreSQL 16's recommendation to acquire locks consistently; aborting a deadlock is not accepted as successful completion. See [explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html) and [SELECT queue-lock semantics](https://www.postgresql.org/docs/16/sql-select.html).

Search observation expiry is 10 minutes with 60 seconds future skew. The client explicit-submit marker expires after 60 seconds and stores only a destination hash/time; receipts contain a digest, not raw query text or permanent identity. Direct navigation/prefetch does not manufacture submissions. Navigation receipts have a separate purpose; old navigation receipts have only the existing short expiry compatibility window. Storage failure preserves search/navigation and reports degraded analytics coverage. Direct Telegram link clicks remain unobserved. Delivery acknowledgements and in-flight remote messages cannot be atomically retracted with a later database edit.

No new migration is required. Representative EXPLAIN used 10,000 terminal jobs plus the delayed-head/150-successor/B/C backlog and returned exactly eligible B/C. Existing indexes avoid full-table scans; trial indexes measured 0.866 ms versus 0.874 ms without them, which does not justify their cost. The uncommitted trial migration was removed; committed migrations 0000–0008 remain unchanged. `rc02-representative-plan.txt` preserves the comparison. Queue eligibility and active lease ownership remain separate from heartbeat health.

## Reproducible local evidence

The commands and results in this section are the Phase 9 run record. For a new candidate, follow the current [Phase 10 release checklist](directory-release-checklist.md) and run `npm run ops:rehearsal`.

Use Node 24, the lockfile, PostgreSQL 16, and a disposable loopback database named `hker_directory_test`. Never use a production database. Commands:

```sh
npm ci
npx playwright install chromium webkit
ALLOW_DIRECTORY_TEST_RESET=1 npm run test:acceptance
ALLOW_DIRECTORY_TEST_RESET=1 npm run test:e2e:webkit
HKER_BENCHMARK_ALLOW_WRITE=1 npm run benchmark:catalog
docker build -t hker:rc-local .
ALLOW_DIRECTORY_TEST_RESET=1 node scripts/rc-runtime-rehearsal.mjs --image=hker:rc-local
python3 scripts/sanitize-evidence.py
```

Supply the isolated `DATABASE_URL` as described in the [release checklist](directory-release-checklist.md). The final local run uses a fresh `hker-rc-final-20260927` container on loopback port 55449, separate from the earlier trial fixture on 55439. Acceptance supplies mock Telegram and a fictional administrator. The runtime rehearsal independently creates unique internal Docker networks/databases and never accepts an external database URL. It uses real custom-format pg_dump/pg_restore, removes its private temporary dump, and verifies restored content, sessions/administrator, content plans, pending work, readiness recovery and graceful worker shutdown.

Evidence lives in ignored `artifacts/release-candidate/`, plus `.impeccable/review/`, `test-results/` and `playwright-report/`. The workflow uploads these with `always()` and seven-day retention after redaction; local ignored files are not remote CI artifacts until that workflow runs. Private `.next` browser authentication state and database backups are excluded. The manifest records SHA, full source-tree and lockfile fingerprints, versions, stage exit codes/durations and machine-readable test counts. Failed commands preserve nonzero exit status. Optional unavailable WebKit is explicitly BLOCKED and cannot bypass Chromium.

The final candidate is the local commit containing this report; the post-freeze `manifest.json` records its exact SHA and clean source fingerprint. No push is authorized, so replacement-SHA **CI verified: BLOCKED**. **Staging verified: BLOCKED** and **live beta verified: BLOCKED**. The baseline SHA alone is CI verified.

Locally executed unit verification passed **587 tests / 119 files**, with no skips. The integration gate contains **86 tests / 16 files**, including the separate confirmed taxonomy-change regression; its final aggregate, Chromium and image results are recorded by the post-freeze command manifest and JSON reports. Typecheck passed; lint retains 16 legacy warnings and zero errors. Fresh/0003 upgrade/reviewed-schema compatibility checks and the production-image backup/restore rehearsal passed.

Focused WebKit passed **4/4**, zero skipped/flaky tests, covering native confirmation/dialog focus, stale-draft recovery, OR navigation/form round-trip, export download and mobile layout. It exposed a real opener-focus issue: the editor now receives the actual clicked trigger and restores focus after unmount. A focused unit regression covers this behavior. The full required Chromium suite passed **38/38**, zero skips; the final gate is separately recorded in `chromium.json`; no optional browser failure is substituted for that gate. RC browser tests reset only the shared synthetic Admin catalog GET limiter key before their suite, behind acceptance/reset/loopback/test-database guards: preceding operator tests otherwise consume all 120 requests from one simulated client. Production limits and security tests remain unchanged.

Screenshots at 390/768/1440 include Public home/search/detail, empty/invalid/long-content and zero/no-price/no-link states, plus Admin list/editor/import-preview/analytics. Desktop home, mobile search/editor/analytics, tablet detail/import preview and desktop bulk screenshots were visually inspected: no blocking overflow or clipped actions found. The mobile import/download workflow checks document width. These are local browser observations, not physical-device or Telegram-client certification.

## Measured batch cost

Same synthetic fixture, Node 24.15.0, macOS arm64, 10 logical CPUs, local PostgreSQL 16.15, concurrency one. Statement counts include transaction and plan bookkeeping; row processing and intentional writes still scale with size.

| Records | Before bulk / export statements | After bulk / export statements | After bulk / export ms (single sample) |
| --- | --- | --- | --- |
| 1 | 13 / 16 | 16 / 15 | 26.12 / 5.13 |
| 20 | 127 / 111 | 16 / 15 | 12.70 / 5.89 |
| 200 | 1207 / 1011 | 16 / 15 | 31.39 / 12.22 |

The preserved timing sample is `rc05-statements-sample.json`; final reruns refresh `rc05-statements.json`. The tested read budget is 24 statements per operation. These single samples demonstrate round-trip reduction, not production capacity or statistically reliable latency gains.

## Browse, contention and queue observations

A separate disposable PostgreSQL container held 3,000 synthetic listings, 6,000 links, 240 tags and a six-level area hierarchy. `catalog-benchmark.json` records 30 warm serial samples per path and 48 mixed operations with concurrency 8. No measured errors occurred; fixture rows and the container were removed afterward. First-call samples are recorded separately; OS/PostgreSQL caches were not flushed.

| Path | Warm p50 / p95 ms | Statements |
| --- | --- | --- |
| Featured home | 2.42 / 3.89 | 6 |
| Browse | 2.91 / 9.03 | 6 |
| Chinese name search | 108.93 / 179.22 | 6 |
| Tag alias search | 115.87 / 146.36 | 6 |
| Multi-tag AND | 5.88 / 8.45 | 7 |
| Detail | 1.37 / 3.28 | 5 |

The 48 concurrent operations completed in 814.85 ms (about 58.9 operations/s during this short batch), p95 283.55 ms, 296 statements total. This excludes HTTP and remote Telegram. Hardware, raw samples, plans and cold observations are in the report; other local verification could consume host resources.

`content-scenario-samples.json` preserves complete integration scenario durations, including setup/assertions: concurrent hierarchy edit 154.85 ms; conflicting cycle proposals 93.63 ms; authoritative-observation publication changes plus ten simultaneous duplicates 83.41 ms; delayed-head fairness and all 153 deliveries 5,822.62 ms. These are regression scenario wall times, not endpoint latency benchmarks. B/C progressed on the first runner iteration while A remained blocked; acknowledged operations were not resent and stale ownership could not record progress. Baseline/fixed statement counts and deterministic failure logs are the direct before/after comparison; older Phase 7 timing reports are historical.

## Authorized staging and supervised beta

Status labels are separate: implemented; locally verified; CI verified; staging verified; live beta verified. Staging/live beta are BLOCKED pending authorization and an isolated environment. No push, deployment, live webhook, credential rotation or real-user message is part of this local exercise.

1. Freeze the exact candidate SHA and image digest; run its CI and inspect every required job's final conclusion and protected artifacts. A queued/in-progress run is not a pass.
2. Obtain explicit staging authorization. Review migration preflight against that environment's ledger; take and verify an access-controlled backup in a network-isolated restore environment with mock Telegram.
3. Configure the exact HTTPS origin, secure cookie, trusted proxy overwrite rules, database credentials, session secret, one-time Admin bootstrap and persistent worker/cleanup scheduling. Do not expose origin access around the proxy.
4. Load clearly fictional content. Check liveness, DB readiness, eligible/claimed/completed/retried work and queue age separately. Test Admin authorization, CSRF, publish/unpublish and backup recovery from the image.
5. Only with a dedicated authorized Bot/chat, exercise `/start`, `all`, menu pagination, multi-tag AND/OR, website-only records, callback ownership, restart recovery and unavailable links. Browser mobile viewports do not certify a physical phone or Telegram client.
6. Supervise a small beta: locate an entry, change filters, open a supported link and report one confusing state. Record blockers against the candidate SHA; keep optional suggestions separate and create no new persistent profile system.
7. Remove fictional data/test credentials and disable the dedicated test webhook/scheduler as agreed. Preserve bounded sanitized evidence.

Rollback after accepted writes requires stopping writes/worker claims, preserving the current database and reconciling post-backup writes. Prefer a compatibility-tested application rollback against the forward schema. Restore into a separate database only with an explicit reconciliation/cutover plan; restoring an earlier backup or blindly reverting code is not lossless. Never execute destructive down-migrations or rewrite an unfamiliar ledger automatically.
