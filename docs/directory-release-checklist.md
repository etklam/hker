# Directory release checklist

This is the authoritative release procedure for the curated Hong Kong directory. Phase 7/8 observations and Phase 9 regression evidence are historical context; current candidate evidence and the remaining external gates are in the [Phase 10 handover](directory-phase10-beta-handover.md). The [K3s runbook](k3s-deploy.md) uses the same render and apply tooling described here.

## Re-run the local gates

Use Node 24 (`.nvmrc`), npm lockfile install, and PostgreSQL 16. Run integration acceptance only against a disposable PostgreSQL database on loopback named `hker_directory_test`. `scripts/acceptance.mjs` and `scripts/migration-acceptance.mjs` enforce that name, loopback host, and `ALLOW_DIRECTORY_TEST_RESET=1`; never relax those checks to reach a container or remote database.

```sh
fnm install 24
fnm use 24
npm ci

# Supply DATABASE_URL from a private local environment for the disposable
# loopback database, then run the guarded test suite.
export ALLOW_DIRECTORY_TEST_RESET=1
npm run test:acceptance
unset DATABASE_URL ALLOW_DIRECTORY_TEST_RESET

# This command rejects an inherited DATABASE_URL and creates its own isolated
# Compose projects, generated credentials, and disposable PostgreSQL volumes.
npm run ops:rehearsal
npm run ops:k3s:render
```

`test:acceptance` reruns typecheck, lint, unit and integration tests, the Phase 9 RC-01..05 regressions, guarded migration acceptance, production build and Chromium journeys. A previous CI count does not certify a changed candidate. The release rehearsal requires the local Docker daemon and runs the candidate's production image without source mounts. It runs candidate migration preflight/application, bootstrap, Web and watch worker; imports, duplicate review, export, discovery, external links, unpublish, authenticated mock webhook, cleanup, read-only doctor, negative configuration/schema/migration cases, database interruption, backup/restore, and the committed predecessor against the forward schema.

The rehearsal builds one dirty-or-clean candidate image and a separate committed predecessor image for rollback compatibility. It records a local Docker image ID, not a registry digest. Its unique evidence directory is printed in the result under `evidenceDirectory`; the host dump and generated environment files are removed. Only the exact generated Compose projects and their disposable volumes are removed. The candidate image is left available for review and promotion.

## Runtime commands

The same commands are bundled under `ops/` in the production image. Runtime secrets are injected when a container or one-shot job starts, never passed as Docker build arguments.

| Image command | Effect |
| --- | --- |
| `node ops/migrate.cjs` | Read-only migration ledger preflight. |
| `node ops/migrate.cjs --apply` | Applies reviewed migrations after preflight. Use only on a disposable database or an explicitly authorized target after backup and writer quiescence. |
| `node ops/create-admin.cjs` | One-time bootstrap. Refuses an existing email without changing or promoting it. Keep its short-lived credentials out of Web/worker environments. |
| `node ops/start.cjs` | Validates configuration and starts the Web server. |
| `node ops/bot-runner.cjs --watch` | Durable Bot worker. Web-only mode uses `TELEGRAM_DELIVERY_MODE=disabled` and zero workers. |
| `node ops/analytics-cleanup.cjs` | Bounded Bot, content, analytics and maintenance-evidence cleanup; records sanitized outcome/counts in `directory_maintenance_runs`. |
| `node ops/doctor.cjs` | Read-only, detailed CLI diagnosis of configuration, DB identity hash, required release schema, migration preflight, worker evidence and cleanup. It does not contact Telegram or mutate data. |
| `node ops/telegram-ops.mjs inspect` | Local config-only dry run. Add `--network` only for an authorized `getMe`/`getWebhookInfo` inspection. |
| `node ops/telegram-ops.mjs set-webhook` | Network inspection and dry run. Mutation additionally requires `--apply`, exact Bot identity, HTTPS endpoint, webhook secret and a separate explicit acknowledgment. |

`/api/health` is liveness and remains independent from the database. `/api/ready` checks the Web's required table/column contract and exposes only `ready` or `unavailable`; it never migrates. Worker health comes from a process-local file/identity; diagnostic progress is separate from an idle worker heartbeat. Detailed diagnostics stay in the CLI/Admin boundary.

## Configuration boundary

Use `.env.example` only as a local starting point; replace the local password placeholder and session secret before starting Compose. Never reuse these local values for staging or production.

| Setting | Contract |
| --- | --- |
| `HKER_ENVIRONMENT` | `local`, `test`, `staging` or `production`; staging/production require explicit HTTPS origin and proxy trust setting. |
| `DATABASE_URL` | PostgreSQL URL for this environment's directory database. Staging/test and production never share databases, Bot jobs or Bot credentials. |
| `APP_BASE_URL` | Exact origin, with no path/query. Production and staging use HTTPS and `__Host-` session cookies. |
| `TRUST_PROXY_HEADERS` | Explicit `true`/`false` in staging/production. Enable only behind an ingress that overwrites forwarded client IPs and blocks direct origin access. |
| `AUTH_SESSION_SECRET` | Existing strong signing secret. Do not rotate implicitly during deploy; worker/bootstrap roles do not receive it. |
| `TELEGRAM_DELIVERY_MODE` | `mock` for local/test, `live` only with protected runtime credentials, or `disabled` for Web-only operation. Staging live mode requires a dedicated `TELEGRAM_TEST_CHAT_ID`. Unknown values fail closed. |
| `TELEGRAM_WEBHOOK_SECRET` | Required by Web when live mode accepts Telegram webhook requests; worker does not need it. The webhook route retains secret validation when staging access protection is arranged. |
| `ANALYTICS_ACTION_SECRET` | Optional HMAC key. If set, keep it consistent across Web instances. Analytics can be disabled/degraded without disabling discovery. |

Mock delivery belongs only to an isolated synthetic database. The rehearsal strips inherited database, Admin, session and Telegram variables from its Docker subprocess and injects an empty token plus mock mode. It cannot consume a real Bot queue under its defaults.

## Upgrade, recovery and promotion

Migration `0009_bright_palladium` adds bounded maintenance-run evidence. Migration preflight verifies the full ledger prefix and checksums; never replay SQL by hand, rewrite ledger rows, use `db:push`, or delete a namespace as a repair. The image-only rollback test starts the committed Phase 9 Web and worker against the candidate's forward schema. It does not prove that unrelated future migrations remain backward compatible.

Before an authorized staging migration, identify the exact candidate/image digest and database, stop writers and the worker, take a recoverable backup to separate storage, restore it into a separate database and verify it, run the target's read-only preflight, then apply the candidate migration once and start the matching Web/worker. Reopen ingress only after readiness and the selected smoke cases pass. Application-image rollback and database restore are different actions; preserve writes accepted after a backup and coordinate any connection switch. Never run a destructive down migration or restore over the source database.

`ops:rehearsal` produces a local image ID. To promote the exact tested bytes, tag and push that image to the approved registry/platform, record the returned registry manifest digest, and render K3s with `HKER_IMAGE=registry/path@sha256:<digest>`. Do not rebuild a second application image for staging; do not use `latest` as the release identity. The K3s tool applies nothing by default. Its explicit apply path requires exact context/namespace/image/origin confirmations, a candidate migration preflight/review acknowledgment, verified separate backup, quiesced writers and an explicit mutation acknowledgment.

## Cleanup evidence

The rehearsal ages only fictional rows and verifies one cleanup removes expired Bot bodies/jobs/sessions/leases, expired content plans/history, analytics receipts/aggregates and old maintenance evidence. It reruns cleanup and requires zero second-pass deletions while a locked Bot job and unexpired content plan remain. `directory_maintenance_runs` records sanitized execution status and counts; the read-only doctor reports the last observed run.

Local Compose rehearsal uses an explicit one-shot cleanup command. K3s supplies one daily CronJob in `Asia/Hong_Kong`; `Forbid` prevents overlap from that CronJob only and is not a cluster-wide lock. A scheduled job is not evidence of execution: inspect the cleanup ledger and CronJob result. See the official [Kubernetes CronJob semantics](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/).

## External release gates

- **Staging applied/verified:** not implied by offline K3s rendering or local Docker rehearsal. Requires target authorization, exact candidate promotion, private configuration, ingress/network protection, backup evidence, migration ledger reconciliation and staging smoke.
- **Live Telegram verified:** not implied by mock delivery. Requires a separately authorized dedicated chat and webhook action. Never set `drop_pending_updates=true`; `getWebhookInfo` does not expose or prove the configured secret token. See [Telegram `setWebhook`](https://core.telegram.org/bots/api#setwebhook) and [`getWebhookInfo`](https://core.telegram.org/bots/api#getwebhookinfo).
- **Real content approved:** remains an owner/content gate. Rehearsal listings are fictional and must not be presented as current businesses, prices, official status or reviews.
- **Independent backup and host-loss recovery:** not proven by a local backup on the same machine. Record storage, retention, roles/extensions and a separate target restore before claiming recovery objectives.
