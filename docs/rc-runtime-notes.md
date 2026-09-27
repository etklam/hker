# RC runtime and restore rehearsal

`scripts/rc-runtime-rehearsal.mjs` is the release-candidate runtime check. It refuses to run unless `ALLOW_DIRECTORY_TEST_RESET=1`, ignores the shell's `DATABASE_URL`, creates only uniquely named `hker-rc-*` containers and a private Docker network, and always removes the containers, network and temporary custom-format backup. Telegram delivery is forced to `mock`.

Run it against the exact candidate image:

```sh
ALLOW_DIRECTORY_TEST_RESET=1 node scripts/rc-runtime-rehearsal.mjs --image=hker:rc-local
```

The rehearsal uses the same application image for migration preflight/apply, one-time Admin bootstrap, Website and Bot runner. It creates synthetic taxonomy and two listings through the authenticated Admin API, with two same-type links, one public listing and one draft. It also creates a pending content plan and a durable Bot job. It then verifies:

- Website liveness remains available while PostgreSQL is stopped, readiness becomes `503`, and readiness recovers after the database restarts.
- The Website container restarts against the same data, Admin can authenticate, and public discovery still excludes the draft.
- `pg_dump --format=custom` produces a readable archive; `pg_restore --exit-on-error --no-owner` restores it into a separate fresh PostgreSQL database.
- Source and restored migration ledger, listing/link identities, revisions, taxonomy relations, content plan, pending job and Admin identity match exactly before restored runtime use.
- The restored Website authenticates the Admin and preserves public visibility.
- A restored mock Bot job is interrupted with `SIGTERM` after it is claimed. The worker exits zero, releases its lease, leaves retryable progress, and a new runner completes the remaining operations and records a heartbeat.

## Candidate evidence

The final candidate uses the unchanged nine-migration chain through `0008`. Read the exact tested image ID, Node/PostgreSQL versions, restored counts, outage/recovery states and timings from `artifacts/release-candidate/runtime-rehearsal.json`; `image-digest.txt` identifies the built artifact. The post-freeze acceptance manifest identifies the source SHA. Historical trial images are not candidate evidence.

The migration rehearsal covers fresh installation, `0003` to the nine-migration head, and the reviewed `0008` schema against that same head as a no-op compatibility check. It preserves listing revision and relationships, link identity and URL, a pending content plan and a pending Bot job. The acceptance migration stage records its result and fails on any mismatch.

Run both rehearsals after source changes. Only a successful result for the frozen image certifies local runtime verification; it does not certify staging or a real production backup.

## Rollback boundary

The custom archive proves recoverability of the captured synthetic point in time. Restoring a backup does not preserve writes accepted after that backup. Before an authorized rollback, stop writers and Bot workers, take and verify a current backup, restore into a separate database, reconcile post-backup writes, run migration preflight, test the application against the restored copy, and switch connections deliberately. Do not rewrite a deployed migration ledger or run destructive down-migrations.
