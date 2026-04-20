# HKER Deployment To CapRover

This document is a reusable CapRover runbook for HKER. It is intentionally sanitized. Do not store live passwords, hostnames, or session secrets in this file.

## What You Need

- a CapRover server
- `caprover` CLI installed locally
- a Git branch or image you want to deploy
- a PostgreSQL database app on the same CapRover cluster

## App Topology

- App: `hker` for the Next.js application
- App: `hker-db` for PostgreSQL
- Internal DB host: `srv-captain--hker-db`
- App container port: `3000`

## Required Environment Variables

Match these to `.env.example`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_BASE_URL` | Public base URL for the app |
| `AUTH_SESSION_SECRET` | Session HMAC secret, use a long random value |
| `AUTH_SESSION_COOKIE_NAME` | Cookie name, defaults to `hker_session` |
| `AUTH_SESSION_TTL_DAYS` | Session lifetime in days |
| `TRUSTED_PROXIES` | Optional comma-separated trusted proxy IPs |

For the database app:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |

## One-Time Setup

### 1. Create the PostgreSQL app with persistent storage

```bash
caprover api -n <machine-name> -t /user/apps/appDefinitions/register -m POST
# data:
# {"appName":"hker-db","hasPersistentData":true}
```

### 2. Configure the PostgreSQL app

```bash
caprover api -n <machine-name> -t /user/apps/appDefinitions/update -m POST
# data:
# {
#   "appName":"hker-db",
#   "instanceCount":1,
#   "notExposeAsWebApp":true,
#   "forceSsl":false,
#   "envVars":[
#     {"key":"POSTGRES_DB","value":"<db-name>"},
#     {"key":"POSTGRES_USER","value":"<db-user>"},
#     {"key":"POSTGRES_PASSWORD","value":"<db-password>"}
#   ],
#   "volumes":[{"containerPath":"/var/lib/postgresql/data","volumeName":"hker-db-data"}],
#   "ports":[{"hostPort":54322,"containerPort":5432}]
# }
```

### 3. Deploy PostgreSQL

```bash
caprover deploy -n <machine-name> -a hker-db -i postgres:16-alpine
```

### 4. Create the HKER app

```bash
caprover api -n <machine-name> -t /user/apps/appDefinitions/register -m POST
# data:
# {"appName":"hker"}
```

### 5. Configure the HKER app

`containerHttpPort` must be `3000`. If you leave the CapRover default at `80`, the app will deploy and still serve 502s.

```bash
caprover api -n <machine-name> -t /user/apps/appDefinitions/update -m POST
# data:
# {
#   "appName":"hker",
#   "instanceCount":1,
#   "notExposeAsWebApp":false,
#   "forceSsl":false,
#   "containerHttpPort":3000,
#   "envVars":[
#     {
#       "key":"DATABASE_URL",
#       "value":"postgresql://<db-user>:<db-password>@srv-captain--hker-db:5432/<db-name>"
#     },
#     {"key":"APP_BASE_URL","value":"https://<your-domain>"},
#     {"key":"AUTH_SESSION_SECRET","value":"<32+ byte random secret>"},
#     {"key":"AUTH_SESSION_COOKIE_NAME","value":"hker_session"},
#     {"key":"AUTH_SESSION_TTL_DAYS","value":"30"},
#     {"key":"TRUSTED_PROXIES","value":""}
#   ]
# }
```

### 6. Deploy the app

From a Git branch:

```bash
caprover deploy -n <machine-name> -a hker -b <branch>
```

Or from a built image:

```bash
caprover deploy -n <machine-name> -a hker -i <image:tag>
```

## Database Bootstrap Note

At the moment this repo contains Drizzle schema definitions and `drizzle.config.ts`, but it does not check in generated `drizzle/` migration SQL yet.

That means you currently have two sane production bootstrap options:

1. generate and commit migrations before release, then run `npm run db:migrate`
2. for first-time environment setup only, run `npm run db:push` against the target database from a trusted operator machine

Do not treat `db:push` as a long-term release process for a multi-person production workflow.

## Routine Deploys

If the app and database definitions are already set up:

```bash
git push origin <branch>
caprover deploy -n <machine-name> -a hker -b <branch>
```

## Post-Deploy Checks

Run these after each deploy:

```bash
curl -sf https://<your-domain>/api/health
curl -I https://<your-domain>
```

Then manually verify:

- register and login
- collections page loads
- marketplace page loads
- family todo page loads
- admin page is reachable only for admin users

## Known CapRover Pitfalls

### `public/` missing during Docker build

Symptom:

```text
COPY failed: stat app/public: file does not exist
```

Fix:

- keep `public/` in the repo with at least one tracked file such as `public/.gitkeep`

### App deploys but returns 502

Cause:

- CapRover is still routing to port `80`

Fix:

- set `containerHttpPort` to `3000`

### SSL issuance fails temporarily

Cause:

- usually DNS propagation or ACME timing

Fix:

- confirm plain HTTP works first
- retry SSL issuance later
