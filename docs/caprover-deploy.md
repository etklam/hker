# HKER Deployment To CapRover

This document is a reusable CapRover runbook for HKER. It is intentionally sanitized. Do not store live passwords, hostnames, or session secrets in this file.

## What You Need

- a CapRover server
- SSH access to the server (password or key)
- a PostgreSQL database app on the same CapRover cluster
- the project repo at `~/Desktop/project/hker`

## App Topology

- App: `hker` — Next.js application (Docker service: `srv-captain--hker`)
- App: `hker-db` — PostgreSQL (Docker service: `srv-captain--hker-db`)
- Internal DB host: `srv-captain--hker-db:5432`
- App container port: `3000`
- Docker image: `hker:latest`

## Required Environment Variables

Match these to `.env.example`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_BASE_URL` | Public base URL for the app. Use the final `https://` origin in production so auth cookies are issued as `Secure`. |
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

---

## Deployment Method: Direct Docker Build (Recommended)

The CapRover API (upload tarball, set env vars) is unreliable — frequently returns 404 or ISE. The most reliable method is to build the Docker image directly on the server and update the Swarm service.

### Quick Deploy (script)

A deploy script is provided at `scripts/deploy.sh`. Usage:

```bash
# From the project root
bash scripts/deploy.sh
```

This will:
1. Package the source into a clean tarball
2. SCP tarball + deploy script to the server
3. Build the Docker image on the server
4. Run `drizzle-kit push` for DB migration
5. Update the Docker Swarm service
6. Verify the service is running
7. Fix nginx port if needed

### Manual Step-by-Step

#### 1. Package source code

```bash
cd ~/Desktop/project/hker

env COPYFILE_DISABLE=1 tar \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./.next' \
  --exclude='./.claude' \
  --exclude='./coverage' \
  --exclude='./.gstack' \
  --exclude='./src/db/migrations' \
  --exclude='._*' \
  -czf /tmp/hker-deploy.tgz .

# Verify no AppleDouble contamination
tar -tzf /tmp/hker-deploy.tgz | grep '/\._\|^\._' && echo "CONTAMINATED" || echo "CLEAN"
```

#### 2. Upload to server

```bash
scp /tmp/hker-deploy.tgz root@SERVER_IP:/tmp/
scp scripts/deploy-remote.sh root@SERVER_IP:/tmp/
```

#### 3. SSH to server and build

```bash
ssh root@SERVER_IP
mkdir -p /tmp/hker-build && cd /tmp/hker-build
tar xzf /tmp/hker-deploy.tgz
docker build --network=host -t hker:latest -f Dockerfile .
```

#### 4. Run DB migration

```bash
# Get DATABASE_URL from the running container
HKER_ID=$(docker ps --filter name=srv-captain--hker --format "{{.ID}}" | head -1)
DB_URL=$(docker inspect "$HKER_ID" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep DATABASE_URL | cut -d= -f2-)

# Run drizzle-kit push via a temporary container on the overlay network
docker run --rm \
  --network captain-overlay-network \
  -v /tmp/hker-build:/app \
  -w /app \
  -e DATABASE_URL="$DB_URL" \
  node:20-alpine \
  sh -c "npm install && npx drizzle-kit push"
```

#### 5. Update the service

```bash
docker service update --image hker:latest --force srv-captain--hker
```

#### 6. Fix nginx port (if needed)

CapRover sometimes regenerates nginx config with port 80 instead of 3000.

```bash
NGINX=$(docker ps --filter name=captain-nginx --format "{{.ID}}" | head -1)

# Check current config
docker exec "$NGINX" grep "srv-captain--hker" /etc/nginx/conf.d/captain.conf

# Fix if showing :80 instead of :3000
docker exec "$NGINX" sed -i 's|http://srv-captain--hker:80|http://srv-captain--hker:3000|g' /etc/nginx/conf.d/captain.conf
docker exec "$NGINX" nginx -t && docker exec "$NGINX" nginx -s reload
```

#### 7. Verify

```bash
curl -sf http://hker.<domain>/api/health
# Expected: {"status":"ok","service":"hker",...}
```

---

## One-Time Setup (First Deploy Only)

### 1. Create the PostgreSQL app

```bash
# Login to CapRover API
TOKEN=$(curl -s "http://SERVER_IP:3000/api/v2/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"password":"PASSWORD"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# Create app with persistent data
curl -s "http://SERVER_IP:3000/api/v2/user/apps/appData" \
  -X POST -H "Content-Type: application/json" \
  -H "x-captain-auth: $TOKEN" \
  -d '{"appName":"hker-db","hasPersistentData":true}'
```

Then set env vars and deploy the `postgres:16-alpine` image (see "Alternative: CapRover API / CLI" below).

### 2. Create the HKER app

```bash
curl -s "http://SERVER_IP:3000/api/v2/user/apps/appData" \
  -X POST -H "Content-Type: application/json" \
  -H "x-captain-auth: $TOKEN" \
  -d '{"appName":"hker"}'
```

### 3. Set environment variables

The CapRover API env var endpoint (`PUT /api/v2/user/apps/appData/:appName`) is unreliable. Prefer editing `/captain/data/config-captain.json` directly on the server, then restarting captain:

```bash
ssh root@SERVER_IP
# Edit the JSON, add env vars under appDefinitions.hker.envVars
vi /captain/data/config-captain.json
docker service update --force captain-captain
```

Or use `docker service create` with `--env` flags directly (see skill).

**Critical:** `containerHttpPort` must be `3000`. If left at the default `80`, nginx will route to the wrong port → 502.

### 4. Initial DB bootstrap

```bash
# After first deploy, run migration to create tables
docker run --rm \
  --network captain-overlay-network \
  -v /tmp/hker-build:/app \
  -w /app \
  -e DATABASE_URL="postgresql://<user>:<pass>@srv-captain--hker-db:5432/<db>" \
  node:20-alpine \
  sh -c "npm install && npx drizzle-kit push"
```

---

## Alternative: CapRover API / CLI (Unreliable)

The `caprover` CLI and API endpoints can be used for simpler operations. The app creation endpoint is reliable; env var updates and tarball uploads are not.

```bash
# Login
TOKEN=$(curl -s "http://SERVER_IP:3000/api/v2/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"password":"PASSWORD"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# Create app
curl -s "http://SERVER_IP:3000/api/v2/user/apps/appData" \
  -X POST -H "Content-Type: application/json" \
  -H "x-captain-auth: $TOKEN" \
  -d '{"appName":"hker"}'

# Upload tarball — field name MUST be "sourceFile"
curl -s "http://SERVER_IP:3000/api/v2/user/apps/appData/hker" \
  -X POST \
  -H "x-captain-auth: $TOKEN" \
  -F "sourceFile=@/tmp/hker-deploy.tgz"
```

### CapRover API Reliability Reference

| Endpoint | Method | Purpose | Reliability |
|----------|--------|---------|-------------|
| `/api/v2/login` | POST | Auth → token | ✅ Reliable |
| `/api/v2/user/apps/appData` | POST | Create app | ✅ Reliable |
| `/api/v2/user/apps/appData/:appName` | PUT | Update config (env vars, volumes) | ❌ Often 404/ISE |
| `/api/v2/user/apps/appData/:appName` | POST | Deploy (upload tarball) | ⚠️ Sometimes ISE |

---

## Database Migration Notes

The repo uses Drizzle ORM. Schema changes require migration before or during deploy.

- **`drizzle-kit push`** — Pushes schema directly to DB (no migration files needed). Use for solo dev / first-time setup.
- **`drizzle-kit migrate`** — Applies generated SQL migration files. Preferred for multi-person teams.

Current workflow: `drizzle-kit push` via temporary container on the overlay network during deploy.

Do not treat `db:push` as a long-term release process for a multi-person production workflow.

---

## Post-Deploy Checks

Run these after each deploy:

```bash
curl -sf http://hker.<domain>/api/health
curl -I http://hker.<domain>
```

Then manually verify:

- register and login
- session cookie is returned with the `Secure` attribute on HTTPS
- collections page loads
- marketplace page loads
- family todo page loads
- admin page is reachable only for admin users
- monthly bills tool loads

---

## Known Issues & Pitfalls

### `npm ci` fails in Docker build

**Symptom:**

```text
npm error Missing: @esbuild/linux-x64@0.28.0 from lock file
```

**Cause:** Local `package-lock.json` is out of sync (e.g. npm version mismatch between macOS and Docker).

**Fix:** Either:
1. Run `npm install` locally to regenerate the lock file, then commit and redeploy
2. Temporarily change `npm ci` to `npm install` in the Dockerfile for this deploy

### `public/` missing during Docker build

**Symptom:**

```text
COPY failed: stat app/public: file does not exist
```

**Fix:** Keep `public/` in the repo with at least one tracked file such as `public/.gitkeep`.

### App config update silently resets `containerHttpPort`

**Symptom:** NGINX 502 after config update.

**Fix:** Set `containerHttpPort` back to `3000` in the app definition or fix nginx manually (see step 6 above).

### Auth routes fail after a DB rebuild but `/api/health` is still 200

**Cause:** `/api/health` does not touch the database. The DB may be missing schema or has wrong credentials.

**Fix:**
- Verify PostgreSQL app has a persistent volume attached
- Re-run `drizzle-kit push` against the target DB
- Only treat the deploy as healthy after `register` and `login` both succeed

### macOS tar deploy includes `._*` files

**Symptom:**

```text
Parsing error: Invalid character.
./src/app/.../._page.tsx
```

**Fix:** Create the tarball with `COPYFILE_DISABLE=1` and verify before deploy:

```bash
tar -tzf /tmp/hker-deploy.tgz | grep '/\._\|^\._' && echo "CONTAMINATED" || echo "CLEAN"
```

### SSL issuance fails temporarily

**Cause:** DNS propagation or ACME timing.

**Fix:** Confirm plain HTTP works first, then retry SSL issuance from the CapRover dashboard.
