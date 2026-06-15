#!/bin/bash
# hker deploy script — K3s deployment
# Builds Docker image locally, transfers to g2 server, imports into containerd,
# runs pending DB migrations, and restarts the deployment.
#
# Usage:
#   bash scripts/deploy.sh
#
# Prerequisites:
#   - Docker Desktop running locally
#   - sshpass installed (brew install hudochenkov/sshpass/sshpass)
#   - K8s manifests already applied (first-time only)
#   - Server credentials configured below or in environment

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
SERVER_IP="82.22.63.196"
SSH_USER="root"
SSH_PASS="${HKER_SSH_PASS:?Set HKER_SSH_PASS env var or export it}"
NAMESPACE="hker"
APP_NAME="hker"
IMAGE_NAME="${APP_NAME}:latest"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SSH_CMD="sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER_IP}"
BUILD_ARGS=(
  --build-arg DATABASE_URL="postgresql://hker:dummy@localhost:5432/dummy"
  --build-arg APP_BASE_URL="https://hker.me"
  --build-arg AUTH_SESSION_SECRET="build-time-dummy-not-used-at-runtime"
  --build-arg AUTH_SESSION_COOKIE_NAME="hker_session"
  --build-arg AUTH_SESSION_TTL_DAYS="30"
)

cd "$PROJECT_DIR"

# ── Step 1: Build Docker image ────────────────────────────────────────────
echo "==> Building ${IMAGE_NAME} (linux/amd64)..."
docker build --platform linux/amd64 \
  "${BUILD_ARGS[@]}" \
  -t "$IMAGE_NAME" \
  -f Dockerfile .
echo "    Build complete."

# ── Step 2: Save + compress ───────────────────────────────────────────────
echo "==> Saving image..."
docker save "$IMAGE_NAME" -o /tmp/hker-image.tar
gzip -f /tmp/hker-image.tar
SIZE=$(du -h /tmp/hker-image.tar.gz | cut -f1)
echo "    Compressed: $SIZE"

# ── Step 3: Transfer to server ────────────────────────────────────────────
echo "==> Transferring to ${SERVER_IP}..."
cat /tmp/hker-image.tar.gz | eval "$SSH_CMD" "cat > /tmp/hker-image.tar.gz"
echo "    Transfer complete."

# ── Step 4: Import into containerd ────────────────────────────────────────
echo "==> Importing into containerd..."
eval "$SSH_CMD" "gunzip -f /tmp/hker-image.tar.gz && k3s ctr images import /tmp/hker-image.tar"
echo "    Import complete."

# ── Step 5: Run pending migrations ────────────────────────────────────────
echo "==> Checking for pending migrations..."
DB_POD=$(eval "$SSH_CMD" "kubectl get pods -n ${NAMESPACE} -l app=${APP_NAME}-db -o jsonpath='{.items[0].metadata.name}'")

for migration_file in "$PROJECT_DIR"/drizzle/[0-9]*.sql; do
  [ -f "$migration_file" ] || continue
  migration_name=$(basename "$migration_file")
  
  # Transfer migration to server, then into pod
  cat "$migration_file" | eval "$SSH_CMD" "cat > /tmp/${migration_name}"
  eval "$SSH_CMD" "kubectl cp /tmp/${migration_name} ${NAMESPACE}/${DB_POD}:/tmp/${migration_name}"
  
  echo "    Running ${migration_name}..."
  eval "$SSH_CMD" "kubectl exec -n ${NAMESPACE} ${DB_POD} -- psql -U hker -d hker -f /tmp/${migration_name}" 2>/dev/null && \
    echo "    OK" || echo "    SKIP (may already exist)"
done

# ── Step 6: Restart deployment ────────────────────────────────────────────
echo "==> Restarting deployment..."
eval "$SSH_CMD" "kubectl rollout restart deployment/${APP_NAME}-app -n ${NAMESPACE}"
eval "$SSH_CMD" "kubectl rollout status deployment/${APP_NAME}-app -n ${NAMESPACE} --timeout=120s"
echo "    Rollout complete."

# ── Step 7: Verify ────────────────────────────────────────────────────────
echo "==> Verifying..."
eval "$SSH_CMD" "kubectl get pods -n ${NAMESPACE}"

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' https://hker.me/)
echo "    HTTPS: ${HTTP_CODE}"

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "==> Deploy complete! ✅"
else
  echo ""
  echo "==> ⚠️  Deploy finished but HTTPS returned ${HTTP_CODE} (expected 200)"
  echo "    Check: kubectl logs -n ${NAMESPACE} deployment/${APP_NAME}-app --tail=50"
fi

# Cleanup
rm -f /tmp/hker-image.tar /tmp/hker-image.tar.gz
