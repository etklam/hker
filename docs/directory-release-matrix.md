> Latest extended Phase 7 evidence: [extended acceptance matrix](directory-phase7-extended.md) and [performance observations](directory-performance-observations.md). Earlier counts below are historical; the extended final aggregate passed 547 unit / 60 integration / 34 Chromium tests with zero skips. Staging/live gates remain open.

> Historical evidence inherited in the dirty worktree. For this request's independently rerun commands, additional defects and current limitations, use [Phase 7 checklist](directory-phase7-checklist.md). The statement below that the working tree was clean describes an earlier run, not the start of this request.

# Directory completion evidence matrix

Reviewed baseline: 251bb2e3b5ffb660ab14d6dcbf0809a4ef4a3c60. Working tree was clean; no newer commits. The previous phase report describes the first usable release, not release acceptance for this assignment.

| Requirement | Baseline classification | Implementation / evidence under verification |
|---|---|---|
| Executor ownership / small pool | Defective: bot/import global acquisition in transactions | Explicit executor services and max=2 concurrency tests |
| Taxonomy deletion / preset integrity | Defective: SET NULL / cascade broadening | Restrict FK + impact conflict + disable |
| Search contract OR / precedence | Defective: form loses OR | Shared resolver/serialization and round-trip tests |
| Stable links / optimistic writes | Incomplete | Child identity / revisions / conflict preservation |
| Chinese ranking / aliases / price scope | Incomplete | Explainable tiers, bounded attrs, aliases, HKD scope |
| CMS/Public UX | Implemented baseline, incomplete hardening | Searchable taxonomy, reorder, typed forms, screenshots |
| Bot reachability / delivery recovery | Incomplete | Paginated menus, ownership, durable retry runner, cleanup |
| Import usable format / decisions / retry | Incomplete | Slug/name mapping, typed links, warnings, job receipts |
| Analytics | Incomplete: only inventory counts | Privacy-filtered aggregate events, dedup, redirects |
| Runtime/image/migrations | Defective: secrets at build, unsafe deploy replay | Runtime validation, migration preflight, image tests |
| Dependency advisories | Defective / applicability review required | Compatible supported upgrades, audit evidence |
| Reproducible acceptance | Incomplete: fixture-dependent skip | Guarded setup and strict acceptance CI |
| Staging/live Telegram | Externally blocked | Credentials and authorized dedicated chat not provided |

Baseline commands and final exact results will be recorded separately in the release checklist. An early integration attempt was contaminated by parallel schema edits (15 skipped after setup failure); a source archive of the reviewed commit is used to obtain valid baseline results. No failure is counted as a pass.

## Final local evidence (2026-09-27 Asia/Taipei)

Environment: macOS host, Node 24.21.0, PostgreSQL 16 in disposable Docker container, Next 15.5.26. Test URLs use loopback; no production credentials/data used. Commands below were executed, not inferred from scripts. Staging and live Telegram remain externally blocked.

| Requirement | Current classification | Evidence |
|---|---|---|
| Transaction ownership, pool starvation | Implemented, locally verified | `integration/concurrency.test.ts`: six parallel import/Bot pairs, max2 pool, global select trap, bounded completion; recorded run 146ms for this case |
| Dependency deletion / no preset broadening | Implemented, locally verified | `hardening.test.ts`, catalog integration; restrictive FKs, conflict impacts, invalid preset rejection, CMS disable alternative |
| OR / shared state / ranking parity | Implemented, locally verified | 20 shared-helper cases; DB ranking/visibility fixtures; browser OR edit/submit/back flow |
| Chinese name/alias/partial ranking | Implemented, locally verified | NFKC/whitespace fixture, exact tier tests, public attributes/area/category candidate search; stable manual+ID tie-break |
| Price bounds/currency | Implemented, locally verified | DB zero/unknown/open overlap/HKD ordering cases; two decimal input precision enforced; foreign currencies remain displayable |
| Stable links / revision / slug history | Implemented, locally verified | Link ID preservation/cross-listing rejection/stale write tests, browser409 draft, old slug canonical redirect and suggestion reservation |
| Visibility / disabled data | Implemented, locally verified | Public/detail/API/metadata fixtures, Bot pre-send digest/visibility recheck, stored enabled-link redirect guard |
| Bot menus, ownership and limits | Implemented, mock verified | `bot-hardening.test.ts`10 cases: >60 taxonomy,50 long tags, invalid/other-user callbacks, exact all, expired state, max60/min atomic quota |
| Durable Telegram delivery | Implemented, mock verified | Retry429, permanent errors, timeout transport, lease-owner-safe completion, concurrent recovery, deferred webhook returns before hanging transport; real chat/scheduler externally blocked |
| Import | Implemented, locally verified | `import-analytics.test.ts` mapping ambiguity, multi-link/alias/attrs, warnings accept/skip, hard conflicts, atomicity, replay/concurrent retry; browser actual import/template |
| Analytics | Implemented, locally verified | Receipt dedup, privacy rejection,20 concurrent cardinality checks, retention, savepoint failure isolation, enabled outbound; redirect schedules metrics after response |
| CMS and responsive UX | Implemented, locally verified | Browser create/edit/publish/reorder/import, focus/dirty409 protection; actual screenshots390/768/1440 inspected; tablet layout adjusted after inspection |
| Server security / retired surfaces | Implemented, locally verified | Retirement at wrappers/direct endpoints and server layouts; CSRF exact origin, default untrusted proxies, bounded JSON;20 parallel rate requests allow5,10 failed logins retain count10; default cookie logout revokes session |
| Runtime / migrations / rollback path | Implemented, locally verified | Fresh6 and baseline4→6 rehearsal; sample data/linkID preserved, FK/backfill asserts; synthetic pg_dump/pg_restore + preflight; deliberate ledger mismatch refused before apply; final image starts nonroot, no embedded secrets; operational commands executed |
| Dependency updates | Implemented, locally verified | `npm audit --omit=dev`:0 advisories; full audit4 moderate development-tool transitive entries, applicability below |
| Deterministic acceptance / CI | Implemented, full local entry point verified | `scripts/acceptance.mjs`, guarded fixture, strict mode, migration rehearsal, Chromium workflow; full `npm run test:acceptance` exited0; CI definition added but remote CI not run in this session |

## Executed checks

| Command | Executed / passed / failed / skipped |
|---|---|
| Baseline `npm run typecheck`, `npm run lint` | Passed; lint0 errors,16 existing warnings |
| Baseline `npm test -- --maxWorkers=4 --reporter=dot` | 508 /508 /0 /0 (103 files) |
| Baseline source-archive `npm run test:integration` | 15 /15 /0 /0, reviewed commit archive with shared installed dependencies |
| Guarded Node24 `npm run test:acceptance` | Entire workflow exited0, including migration rehearsal and real production browser |
| Final Node24 `npm run typecheck` | Passed |
| Final Node24 `npm run lint` | Passed;0 errors,16 retained legacy warnings |
| Final Node24 `npm test -- --maxWorkers=4 --reporter=dot` | 534 /534 /0 /0 (111 files) |
| Final isolated `npm run test:integration -- --reporter=verbose` | 45 /45 /0 /0 (7 files) |
| `ALLOW_DIRECTORY_TEST_RESET=1 npm run test:migrations` | Fresh and upgrade scenarios2 /2 /0 /0; six migrations current, baseline four |
| Node24 `npm run build` | Passed; no DATABASE_URL/session secret required at build |
| Strict fixture Chromium `npm run test:e2e -- --project=chromium --workers=1 --reporter=list,json` | 26 /26 /0 /0, includes390/768/1440 viewport checks |
| Chromium OR/back/forward `--grep="OR navigation" --repeat-each=10` | 10 /10 /0 /0 after the navigation correction |
| `docker build -t hker:release-candidate .` | Passed with no build secret arguments; runtime Node24.21.0 |
| Container operational commands | migrate preflight/apply, admin bootstrap, Bot run/cleanup, analytics cleanup all succeeded on synthetic DB; missing-env validator failed as expected |
| Running image HTTP | `/`, `/api/health`, `/api/ready`200; retired `/api/featured`410 |
| `git diff --check` | Passed |

Earlier browser attempts were20/23, then25/26: selectors accidentally included React's hidden streaming DOM/route announcer, and back navigation raced before the previous route changed. Tests target actual main/accessible controls and wait for URL transitions. A subsequent stress run passed7/10 and exposed mixed native GET / client navigation races as well as browser-restored fields. Search filter/pagination links now use native anchors consistently with the GET form, and restoration synchronizes only unmanaged inputs (not selected tags). The final repeated back/forward regression passed10/10. These failures were investigated and not counted as passes. The final suite has no skipped fixture tests. Firefox/WebKit engines and real mobile hardware were not executed; Chromium viewport emulation is the local visual acceptance scope.

## Measurements and screenshots

`catalog-explain.ts` uses1,000 synthetic listings and100 tag relations in a rolled-back transaction. After ANALYZE all participating tables: browse0.140ms, Chinese alias/substring6.878ms, exact-name candidates6.640ms, tag filter4.596ms. Before taxonomy ANALYZE, stale estimates triggered ~200–270ms JIT; this is a planning-statistics observation, not a throughput promise. These are candidate SQL timings, not complete service/network latency.

`scripts/bot-explain.sql` measures a10,000-row synthetic Bot journal EXPLAIN used the new due/conversation indexes: due query0.117ms and prior-conversation lookup0.054ms. All inserted rows rolled back. 0005 adds only supporting delivery/retention/alias lookup indexes; existing migrations remain immutable. Run ANALYZE after a large import in operations planning.

Inspected actual PNG artifacts (local, ignored by Git): `.impeccable/review/release/{public,search,admin,editor}-{390,768,1440}.png`. Public blue/white hierarchy, real data-only cards, mobile full-screen editor, readable focus rings, long-name containment and no page-width overflow checked. Reference images were not available, so no pixel-level match claim is made. Screenshot evidence is synthetic, not real Hong Kong business data.

## Dependency applicability

Upgraded Next15.5.26, Drizzle ORM0.45.3/kit0.31.11, Vitest4.1.11 and compatible lockfile patches; runtime Node24LTS. Next's pinned PostCSS8.4.31 required a narrow same-major override to8.5.28, validated by production and image builds. No forced audit downgrade/major framework migration used.

Primary references: [Next advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Drizzle identifier escaping](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9), [PostCSS source-map traversal](https://github.com/postcss/postcss/security/advisories/GHSA-r28c-9q8g-f849), [esbuild development-server issue](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99), [Node release policy](https://nodejs.org/en/about/previous-releases).

The remaining4 moderate audit entries are the drizzle-kit→deprecated esbuild-kit→esbuild0.18 development-tool chain (one underlying esbuild dev-server advisory). Runtime image excludes drizzle-kit and no esbuild development server is exposed. The suggested audit fix downgrades drizzle-kit across incompatible versions, so it was not applied. Windows-specific Next findings do not describe the Linux container exposure; supported patched Next was installed regardless. No user CSS processing or dynamic SQL identifier input is introduced. Audit counts are observations at this verification date, not a future vulnerability guarantee.

## External blockers and residual risks

Actual production ledger reconciliation/backup, staging ingress/HTTPS/scheduler verification, authorized deployment and live Telegram dedicated-chat testing remain unperformed. Delivery may duplicate at the network-send/persist ambiguity window. Analytics events can be dropped on storage failure/timeout and represent observations, not unique people or conversions. Unknown production load requires monitoring and measured tuning; the synthetic measurements do not establish capacity. See the release checklist for exact operator steps.
