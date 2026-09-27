> Current release candidate: [Phase 9 evidence and supervised staging/beta checklist](directory-phase9-release-candidate.md). Phase 7/8 counts below are historical.

> Latest extended Phase 7 evidence: [extended acceptance matrix](directory-phase7-extended.md) and [performance observations](directory-performance-observations.md). Earlier counts below are historical; the extended final aggregate passed 547 unit / 60 integration / 34 Chromium tests with zero skips. Staging/live gates remain open.

# Directory release checklist

Historical Phase 7 rerun, scope boundaries and defect checklist: [Phase 7 acceptance](directory-phase7-checklist.md). Advanced import/behavioral analytics enhancements remain outside Phase 7, regardless of inherited experimental implementation.

This is the current release procedure. The earlier phase completion notes in `directory-rebuild-plan.md` are historical, not evidence of production acceptance. No production deployment, credentials change or live Telegram call was performed for this release.

## Reproducible local acceptance

Use Node 24 (`nvm use`), PostgreSQL 16 and `npm ci`. The test database must be disposable, on loopback and named `hker_directory_test`. For example:

```sh
docker run --name hker-directory-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=directory-test -e POSTGRES_DB=hker_directory_test -p 127.0.0.1:55439:5432 -d postgres:16-alpine
export DATABASE_URL=postgres://postgres:directory-test@127.0.0.1:55439/hker_directory_test
export ALLOW_DIRECTORY_TEST_RESET=1
npx playwright install chromium
npm run test:acceptance
```

`test:acceptance` fails without its safety guard, uses mock Telegram, executes typecheck/lint/unit/safe migrations/DB integration/build, seeds taxonomy/listings and an administrator, then runs Chromium against a production server. Fixtures reset directory rows; never point this at a real database. The private admin storage state is generated under ignored `.next/` after the build. It is not an account credential for another deployment. CI runs this same mode. Ordinary `test:e2e` may skip the seeded suites; that is smoke mode, not release acceptance.

## Build and run

```sh
docker build -t hker:release-candidate .
docker run --rm --env-file /secure/path/hker-runtime.env -p 3000:3000 hker:release-candidate
```

Runtime environment follows `.env.example`. Provide a strong existing `AUTH_SESSION_SECRET` (do not rotate accidentally), database URL and exact APP_BASE_URL origin. Default `__Host-hker_session` requires HTTPS. For local HTTP explicitly use `hker_session`. `TRUST_PROXY_HEADERS=false` is safe by default; enabling it requires an ingress that overwrites `x-real-ip` and prevents direct origin access. Without trusted ingress, anonymous limits share a bucket. No runtime secrets are Docker build args. Container runs as `node`. `/api/health` is liveness; `/api/ready` checks the catalog DB schema. Neither returns credentials.

Operational bundles are shipped inside the runtime image, with dependencies bundled:

```sh
docker run --rm --env-file /secure/path/hker-runtime.env hker:release-candidate node ops/migrate.cjs
# Only after a verified backup and reviewed compatible preflight:
docker run --rm --env-file /secure/path/hker-runtime.env hker:release-candidate node ops/migrate.cjs --apply
# New installations only; ADMIN_EMAIL, ADMIN_PASSWORD (12+ chars), optional ADMIN_NAME are runtime env.
docker run --rm --env-file /secure/path/hker-bootstrap.env hker:release-candidate node ops/create-admin.cjs
```

Admin bootstrap refuses existing email addresses; it does not silently promote or overwrite users. Remove bootstrap secrets after the one-time command. Local equivalents: `npm run db:preflight`, `db:migrate:safe`, `admin:create`.

## Migration safety and rehearsal

Migrations 0000–0003 are unchanged. Phase 8 migrations 0004–0008 remain intact; Phase 9 requires no new schema migration. The isolated rehearsal covers fresh, 0003 upgrade and reviewed 0008 schema compatibility, plus genuine backup/restore from the production image. 0004 adds listing aliases/revisions, old-slug reservations, import receipts, aggregate analytics and durable Bot delivery fields; restrictive taxonomy FKs replace silent SET NULL/cascade broadening. 0005 adds delivery, retention and slug-alias lookup indexes. Existing journal rows lacking ownership are marked completed if fully delivered, otherwise failed with a restart explanation; no unknown user identity is invented.

Preflight checks every ledger hash and timestamp against the repository prefix before applying anything; concurrent migrators serialize with a session advisory lock. A pre-existing schema with no ledger, unknown historical rows or a checksum mismatch causes failure. The historical legacy-ledger mismatch is not automatically repaired. Restore a backup into an isolated rehearsal database, identify the exact schema/history, and create a reviewed reconciliation procedure before deployment. Never replay all SQL blindly, rewrite ledger hashes, run `db:push`, or treat SQL errors as already-applied success.

Backup/restore example (operator-supplied URLs, never embed credentials in docs/logs):

```sh
pg_dump --format=custom --no-owner --file=hker-before-release.dump "$SOURCE_DATABASE_URL"
pg_restore --exit-on-error --no-owner --dbname="$ISOLATED_RESTORE_DATABASE_URL" hker-before-release.dump
DATABASE_URL="$ISOLATED_RESTORE_DATABASE_URL" node ops/migrate.cjs
DATABASE_URL="$ISOLATED_RESTORE_DATABASE_URL" node ops/migrate.cjs --apply
```

Verify row counts, known draft/enabled states, link identities/URLs, admin login and discovery on the restored copy. Keep the backup encrypted and access-controlled. Schema rollback is backup restoration to a separate DB followed by a coordinated connection switch; never drop added columns or force an old writer against new semantics. Stop writes and Bot workers first. An application-only rollback must be compatibility-tested against the forward schema; lost writes after the backup require separate reconciliation.

## Bot and retention

See `directory-telegram.md`. Mock is default; live requires explicit `TELEGRAM_DELIVERY_MODE=live`, token and fail-closed webhook secret. Schedule `node ops/bot-runner.cjs` at least once per minute, and `--cleanup` daily. Schedule `node ops/analytics-cleanup.cjs` daily. Monitor failed jobs and readiness. No Redis or queue service is needed. Active jobs are not cleaned. Terminal Bot dedup lasts 30 days; analytics receipts last 7 days and aggregate days 90. Import receipts remain durable so a lost-response retry does not reimport; archive them only with an explicit retention/idempotency decision.

## External acceptance before release

- Restore an actual production backup and resolve its migration ledger using preflight; local synthetic fresh/upgrade testing cannot prove that deployed history matches.
- Supply real catalog content and administrator ownership; verify proxy trust, HTTPS, cookie settings and persistent scheduler in staging.
- Authorize a dedicated Telegram test chat and webhook; test shared-chat ownership, 429/restart recovery, commands and publication changes. Local transport is mocked and makes no exactly-once claim.
- Deploy only after operator authorization, monitor readiness/errors, rehearse restore and verify backup access.

Exact local results and screenshots are recorded in `directory-release-matrix.md`. These external items remain unchecked.
