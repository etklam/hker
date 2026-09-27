# K3s deployment package and operator runbook

This guide replaces the historical host-specific procedure. It contains no live hostname, IP, namespace, server account or cluster-version assumption. HKER does not install an ingress controller, database, certificate manager, storage provisioner or observability stack. Use the existing approved cluster services and an already managed PostgreSQL database.

The executable renderer is `scripts/render-k3s.mjs` (`npm run ops:k3s:render`). The runtime/cleanup/checklist contract is in the [directory release checklist](directory-release-checklist.md). No step in this runbook was applied to a cluster as part of Phase 10.

## Render and inspect without cluster access

Use Node 24. With no target variables, the command renders fictional `example.invalid` staging values under a unique `artifacts/release-candidate/k3s/` directory. It parses every JSON-subset YAML document, checks object identities, secret references, health paths, migration Job identities, and cleanup concurrency settings. It does not invoke `kubectl`, select the current context, or contact a cluster.

```sh
npm run ops:k3s:render
```

Output includes separate files for:

- `migration-preflight.yaml`: a namespace object plus a unique one-shot, read-only migration ledger preflight Job.
- `migration-apply.yaml`: a separate unique one-shot `ops/migrate.cjs --apply` Job using the same immutable image.
- `runtime.yaml`: internal Web Service, Web and worker Deployments, and one cleanup CronJob.

The preflight must complete before the apply Job is created. The apply tool waits for preflight success, applies the migration Job, waits for migration success, and only then applies the Web/worker/CronJob bundle. A failed preflight or migration therefore cannot roll out the runtime from this tool. Each Job name contains candidate and invocation identity, so an old successful Job cannot satisfy the new wait.

Offline rendering is not Kubernetes API admission or a staging test. The YAML is credential-free, but the selected image and environment are examples until deliberately parameterized. `robots.txt` and `X-Robots-Tag` are indexing hints, not access control. Protect staging at the approved ingress/network layer; permit the narrow `/api/telegram/webhook` route only when the webhook secret is configured.

## Prepare an explicitly authorized staging target

First complete the local gates in the [release checklist](directory-release-checklist.md) and review the unique `candidate-manifest.json`. Its Docker image ID identifies a local image only. Push/tag that same image for the approved platform and record the registry manifest digest; do not rebuild different app bytes for staging and do not use `latest`.

Provision the namespace, database, ingress/network protection, registry pull credentials (if required), and Kubernetes Secrets through the approved infrastructure/secret-management process. The renderer never creates credential values. The runtime Secret must provide `DATABASE_URL` and `AUTH_SESSION_SECRET`. In live Bot mode, the Bot Secret provides `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` to Web, and the dedicated `TELEGRAM_TEST_CHAT_ID` for staging Web/worker. In disabled mode, the worker has zero replicas and the Bot Secret is unused. Keep staging and production databases, Bot credentials and queues separate.

Pass target names and the immutable image digest as environment values; keep Secret contents in the cluster Secret system and out of shell history, manifests and logs:

```sh
export HKER_ENVIRONMENT=staging
export HKER_NAMESPACE='approved-staging-namespace'
export HKER_KUBE_CONTEXT='exact-configured-context'
export HKER_IMAGE='registry.example.invalid/hker@sha256:REPLACE_WITH_MANIFEST_DIGEST'
export HKER_CANDIDATE_ID='reviewed-candidate-id'
export APP_BASE_URL='https://staging.example.invalid'
export HKER_RUNTIME_SECRET='runtime-secret-name'
export HKER_IMAGE_PULL_SECRET='optional-image-pull-secret-name'
export TELEGRAM_DELIVERY_MODE=disabled

node scripts/render-k3s.mjs
```

Review the printed context, namespace, origin, image, candidate, Secret names, disabled/live mode, resources and all three generated files. This command still does not contact a cluster. The preflight/apply Jobs use Secret references for `DATABASE_URL`; committed YAML never contains a connection string.

For live staging Bot operation, set `TELEGRAM_DELIVERY_MODE=live`, provide `HKER_BOT_SECRET`, and confirm the secret contains the dedicated test chat ID. Do not copy a testing token into the repository, Docker build context or command-line arguments. The production mode does not use a staging test chat as a substitute for real content approval.

Before any database mutation, verify the separate backup can be restored, review the candidate migration preflight for this exact target, quiesce writers and the Bot worker, and plan webhook ingress deliberately. Save evidence outside the database host; the local dump in the rehearsal is temporary and does not prove host-loss recovery.

The explicit apply route requires exact target confirmations and all acknowledgments below. Values are comparisons, not credentials. A mismatch stops before kubeconfig access; after acknowledgments the tool confirms the context exists, prints the exact actions, applies preflight, waits, applies migration, waits, then applies runtime.

```sh
export HKER_CONFIRM_CONTEXT="$HKER_KUBE_CONTEXT"
export HKER_CONFIRM_NAMESPACE="$HKER_NAMESPACE"
export HKER_CONFIRM_IMAGE="$HKER_IMAGE"
export HKER_CONFIRM_ORIGIN="$APP_BASE_URL"
export HKER_PREFLIGHTED_MIGRATION_CANDIDATE="$HKER_CANDIDATE_ID"
export HKER_REVIEWED_MIGRATION_CANDIDATE="$HKER_CANDIDATE_ID"
export HKER_BACKUP_VERIFIED=I_VERIFIED_A_SEPARATE_RESTOREABLE_BACKUP
export HKER_WRITERS_QUIESCED=I_QUIESCED_WRITERS_AND_BOT_WORKER
export HKER_K3S_APPLY_ACK=APPLY_REVIEWED_MIGRATION_THEN_RUNTIME

node scripts/render-k3s.mjs --apply
```

This is a database and cluster mutation. It is not part of the default render, and it was not run here. If the preflight or migration Job fails, inspect the Job/Pod logs and the ledger; do not replay SQL or delete the namespace. Restore recovery uses a separate target and an authorized connection switch.

## Runtime behavior

- One Web replica serves HTTP on an internal `ClusterIP` Service. No ingress or public Service is generated.
- One watch worker is started when Bot mode is enabled; `disabled` renders zero workers. Worker health checks a fresh process-local heartbeat file, not Web's port 3000.
- The candidate migration runs in its own Job. App replicas do not run migrations at startup or per request.
- The daily cleanup CronJob runs at 03:17 `Asia/Hong_Kong`, has an active deadline, bounded retry/history and `concurrencyPolicy: Forbid`. `Forbid` only prevents overlap from this CronJob itself; a manual cleanup command or another Job can still overlap. Retention SQL is bounded/idempotent, but the CronJob is not a global lock. See [Kubernetes CronJob semantics](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/).
- The application image contains `ops/start.cjs`, migration/bootstrap/worker/cleanup/doctor bundles and `ops/telegram-ops.mjs`. The runtime Secret is injected to the relevant Pod only; bootstrap credentials are not included in the standard Web/worker Deployments.
- `/api/health` remains a liveness probe and `/api/ready` verifies required Web schema. Database trouble makes readiness fail without forcing a Web restart loop. Worker schema mismatch prevents it processing work.

After an authorized apply, verify Pod readiness, migration/preflight Job outcomes, worker process health/progress, cleanup ledger and public/Admin smoke flows before reopening traffic. A successful CronJob configuration alone is not evidence that cleanup executed; use `node ops/doctor.cjs` from the built image for sanitized operational detail.

## Telegram webhook

The local dry run `npm run ops:telegram -- inspect` contacts no network and prints only configuration presence. Authorized network inspection uses the built image's `node ops/telegram-ops.mjs inspect --network` and calls `getMe` plus `getWebhookInfo`; it prints a sanitized Bot identity and webhook summary. The setup helper performs the same checks before `setWebhook` and requires the exact expected username, HTTPS webhook endpoint, secret, `--apply`, and an explicit acknowledgment. A different existing webhook requires the additional `--replace-existing` decision.

The helper never requests `drop_pending_updates=true` and does not start `getUpdates`. `getWebhookInfo` does not reveal the configured secret token; verify webhook header acceptance/rejection through the candidate's HTTP tests. Live testing is limited to the explicitly authorized dedicated chat; rate-limit injection remains mocked. See Telegram's [`setWebhook`](https://core.telegram.org/bots/api#setwebhook) and [`getWebhookInfo`](https://core.telegram.org/bots/api#getwebhookinfo) documentation.

## Rollback boundary

The Phase 10 rehearsal tests the committed Phase 9 image against the additive forward schema and a synthetic Bot job. This is evidence for that image/schema pair only. For an authorized application rollback, use the previously promoted immutable digest and keep the forward database schema. Database recovery means restoring a verified backup to a separate target, examining writes accepted after the backup, then coordinating a connection switch. Never assume that reverting an image reverses migrations or that a backup preserves later writes.
