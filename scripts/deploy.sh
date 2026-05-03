#!/bin/bash
# hker deploy script — runs LOCALLY from the project root
# Packages source, uploads to server, triggers remote build + migration + update
#
# Usage:
#   bash scripts/deploy.sh [SERVER_IP] [SSH_USER]
#
# Defaults:
#   SERVER_IP = 85.113.70.72
#   SSH_USER  = root

set -euo pipefail

SERVER_IP="${1:-85.113.70.72}"
SSH_USER="${2:-root}"
TARBALL="/tmp/hker-deploy.tgz"
REMOTE_SCRIPT="/tmp/hker-deploy-remote.sh"

# ── Step 0: Pre-flight ──────────────────────────────────────────────────────
echo "==> Pre-flight check"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f "Dockerfile" ]; then
  echo "ERROR: No Dockerfile found in $PROJECT_DIR"
  exit 1
fi

echo "    Project: $PROJECT_DIR"
echo "    Server:  $SSH_USER@$SERVER_IP"

# ── Step 1: Package ─────────────────────────────────────────────────────────
echo "==> Packaging source code..."
env COPYFILE_DISABLE=1 tar \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./.next' \
  --exclude='./.claude' \
  --exclude='./coverage' \
  --exclude='./.gstack' \
  --exclude='./src/db/migrations' \
  --exclude='._*' \
  -czf "$TARBALL" .

CONTAMINATION=$(tar -tzf "$TARBALL" | grep '/\._\|^\._' || true)
if [ -n "$CONTAMINATION" ]; then
  echo "ERROR: AppleDouble files detected in tarball!"
  echo "$CONTAMINATION"
  exit 1
fi

SIZE=$(du -h "$TARBALL" | cut -f1)
echo "    Tarball: $TARBALL ($SIZE) — CLEAN"

# ── Step 2: Write remote script ─────────────────────────────────────────────
cat > "$REMOTE_SCRIPT" << 'REMOTE_EOF'
#!/bin/bash
set -e

echo "=== Step 1: Extract source ==="
rm -rf /tmp/hker-build
mkdir -p /tmp/hker-build
cd /tmp/hker-build
tar xzf /tmp/hker-deploy.tgz 2>/dev/null
echo "    Files extracted."

echo "=== Step 2: Docker build ==="
docker build --network=host -t hker:latest -f Dockerfile .
echo "    Docker build complete."

echo "=== Step 3: DB Migration ==="
HKER_ID=$(docker ps --filter name=srv-captain--hker --format "{{.ID}}" | head -1)
if [ -z "$HKER_ID" ]; then
  echo "    WARNING: hker container not found, skipping migration"
else
  DB_URL=$(docker inspect "$HKER_ID" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep DATABASE_URL | cut -d= -f2-)
  echo "    DATABASE_URL: ${DB_URL%%@*}@***"

  DB_ID=$(docker ps --filter name=srv-captain--hker-db --format "{{.ID}}" | head -1)
  if [ -z "$DB_ID" ]; then
    echo "    WARNING: hker-db container not found, skipping migration"
  else
    echo "    Checking PostgreSQL..."
    until docker exec "$DB_ID" pg_isready -U postgres 2>/dev/null; do
      echo "    Waiting for PostgreSQL..."
      sleep 2
    done
    echo "    PostgreSQL is ready."

    echo "    Running drizzle-kit push..."
    docker run --rm \
      --network captain-overlay-network \
      -v /tmp/hker-build:/app \
      -w /app \
      -e DATABASE_URL="$DB_URL" \
      node:20-alpine \
      sh -c "npm install --silent && npx drizzle-kit push"
    echo "    Migration complete."
  fi
fi

echo "=== Step 4: Update service ==="
docker service update --image hker:latest --force srv-captain--hker
echo "    Service update initiated."

echo "=== Step 5: Wait for stabilization ==="
for i in $(seq 1 12); do
  sleep 5
  REPLICAS=$(docker service ls --filter name=srv-captain--hker --format "{{.Replicas}}")
  echo "    [$i/12] Replicas: $REPLICAS"
  if echo "$REPLICAS" | grep -q "1/1"; then
    echo "    Service is running!"
    break
  fi
done

echo "=== Step 6: Nginx port check ==="
NGINX=$(docker ps --filter name=captain-nginx --format "{{.ID}}" | head -1)
NGINX_LINE=$(docker exec "$NGINX" grep "srv-captain--hker" /etc/nginx/conf.d/captain.conf 2>/dev/null | head -1 || true)
echo "    Config: $NGINX_LINE"

if echo "$NGINX_LINE" | grep -q ":80\b" 2>/dev/null; then
  echo "    Fixing port 80 -> 3000..."
  docker exec "$NGINX" sed -i 's|http://srv-captain--hker:80|http://srv-captain--hker:3000|g' /etc/nginx/conf.d/captain.conf
  docker exec "$NGINX" nginx -t && docker exec "$NGINX" nginx -s reload
  echo "    Port fixed."
else
  echo "    Port looks correct."
fi

echo "=== ALL DONE ==="
REMOTE_EOF

# ── Step 3: Upload ──────────────────────────────────────────────────────────
echo "==> Uploading to server..."
scp -q "$TARBALL" "$REMOTE_SCRIPT" "$SSH_USER@$SERVER_IP:/tmp/"
echo "    Uploaded."

# ── Step 4: Execute remote ──────────────────────────────────────────────────
echo "==> Running remote deploy..."
echo ""
ssh "$SSH_USER@$SERVER_IP" "bash $REMOTE_SCRIPT"

echo ""
echo "==> Deploy complete! ✅"
