# HKER Deployment to K3s (hker.me)

Production deployment runbook for HKER on the g2 K3s cluster. This document is intentionally sanitized — do not store live passwords here.

## Infrastructure

- **Server:** g2 (`82.22.63.196`) — Ubuntu 24.04, x86_64, 2 core / 8GB RAM
- **Runtime:** K3s v1.35.4+k3s1 (single-node control-plane)
- **Container runtime:** containerd (NOT Docker)
- **Ingress:** Traefik (built-in K3s)
- **TLS:** cert-manager + `letsencrypt-cloudflare` ClusterIssuer (DNS-01 via Cloudflare)
- **DNS:** ExternalDNS auto-creates Cloudflare A records from Ingress
- **Storage:** `local-path` provisioner for PVs
- **Domain:** `hker.me` + `www.hker.me` → TLS via Let's Encrypt

## App Topology

- **Namespace:** `hker`
- **App:** `hker-app` — Next.js 15 standalone (port 3000)
- **DB:** `hker-db` — PostgreSQL 16, headless ClusterIP
- **Image:** `docker.io/library/hker:latest` (locally imported, `imagePullPolicy: Never`)
- **Internal DB host:** `hker-db.hker.svc.cluster.local:5432`

## Required Environment Variables

App deployment reads from K8s secrets + inline env:

- `DATABASE_URL` — inline in deployment manifest
- `APP_BASE_URL` — `https://hker.me`
- `AUTH_SESSION_SECRET` — from `hker-app-secrets` secret
- `AUTH_SESSION_COOKIE_NAME` — from `hker-app-secrets` secret
- `AUTH_SESSION_TTL_DAYS` — from `hker-app-secrets` secret
- `TRUSTED_PROXIES` — inline: `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`

DB secret (`hker-db-creds`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

---

## K8s Manifests

All manifests live in `k8s/`:

```
k8s/
├── 00-namespace.yaml
├── 01a-db-secret.yaml
├── 01b-app-secret.yaml
├── 02a-postgres-pvc.yaml
├── 02b-postgres-deployment.yaml
├── 02c-postgres-service.yaml
├── 03-app-deployment.yaml
├── 03b-app-service.yaml
└── 04-ingress.yaml
```

---

## Redeploy (Update Running App)

After code changes on your local machine:

### 1. Build Docker image (macOS → linux/amd64)

```bash
cd ~/Desktop/project/hker

docker build --platform linux/amd64 \
  --build-arg DATABASE_URL="postgresql://hker:dummy@localhost:5432/dummy" \
  --build-arg APP_BASE_URL="https://hker.me" \
  --build-arg AUTH_SESSION_SECRET="build-time-dummy-not-used-at-runtime" \
  --build-arg AUTH_SESSION_COOKIE_NAME="hker_session" \
  --build-arg AUTH_SESSION_TTL_DAYS="30" \
  -t hker:latest \
  -f Dockerfile .
```

**Pitfall:** Always use `--platform linux/amd64` on macOS ARM. Without it the pod crashes with `exec format error`.

### 2. Compress + transfer to server

```bash
# Compress first — ~210MB → ~68MB
gzip -k /tmp/hker-image.tar  # if not already compressed

# Transfer via SSH pipe (more reliable than SCP for large files)
cat /tmp/hker-image.tar | ssh root@82.22.63.196 "cat > /tmp/hker-image.tar"
```

### 3. Import into containerd

```bash
ssh root@82.22.63.196 "k3s ctr images import /tmp/hker-image.tar"
```

### 4. Run DB migrations (if any new ones)

```bash
# Copy migration SQL to server, then into the DB pod
# kubectl cp works from the server only

# Example for a single migration file:
ssh root@82.22.63.196 "
  kubectl cp /tmp/migration.sql hker/\$(kubectl get pods -n hker -l app=hker-db -o jsonpath='{.items[0].metadata.name}'):/tmp/migration.sql
  kubectl exec -n hker deployment/hker-db -- psql -U hker -d hker -f /tmp/migration.sql
"
```

**Pitfall:** Drizzle migration files contain `--> statement-breakpoint` comments that psql ignores — they work as-is.
**Pitfall:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction — run those separately.

### 5. Restart the deployment

```bash
ssh root@82.22.63.196 "
  kubectl rollout restart deployment/hker-app -n hker
  kubectl rollout status deployment/hker-app -n hker --timeout=120s
"
```

### 6. Verify

```bash
# Pods healthy
ssh root@82.22.63.196 "kubectl get pods -n hker"

# HTTPS responding
curl -s -o /dev/null -w '%{http_code}' https://hker.me/
# Expected: 200

# TLS cert valid
ssh root@82.22.63.196 "kubectl get certificate -n hker"
# Expected: READY=True

# App logs
ssh root@82.22.63.196 "kubectl logs -n hker deployment/hker-app --tail=20"
```

**Pitfall:** A 200 on `/` doesn't mean everything works. Test at least one authenticated API call after deploy.

---

## First-Time Setup (Greenfield)

### 1. Apply manifests in order

```bash
# Copy manifests to server
scp k8s/*.yaml root@82.22.63.196:/tmp/k8s/

# Apply in order
ssh root@82.22.63.196 "
  kubectl apply -f /tmp/k8s/00-namespace.yaml
  kubectl apply -f /tmp/k8s/01a-db-secret.yaml
  kubectl apply -f /tmp/k8s/01b-app-secret.yaml
  kubectl apply -f /tmp/k8s/02a-postgres-pvc.yaml
  kubectl apply -f /tmp/k8s/02b-postgres-deployment.yaml
  kubectl apply -f /tmp/k8s/02c-postgres-service.yaml
"
# Wait for DB pod to be Ready before continuing:
ssh root@82.22.63.196 "kubectl wait --for=condition=ready pod -l app=hker-db -n hker --timeout=60s"

# Then apply app + ingress
ssh root@82.22.63.196 "
  kubectl apply -f /tmp/k8s/03-app-deployment.yaml
  kubectl apply -f /tmp/k8s/03b-app-service.yaml
  kubectl apply -f /tmp/k8s/04-ingress.yaml
"
```

### 2. Initial DB migration

```bash
# Copy drizzle migration files and run them
scp drizzle/0000_*.sql root@82.22.63.196:/tmp/migration.sql
ssh root@82.22.63.196 "
  kubectl cp /tmp/migration.sql hker/\$(kubectl get pods -n hker -l app=hker-db -o jsonpath='{.items[0].metadata.name}'):/tmp/migration.sql
  kubectl exec -n hker deployment/hker-db -- psql -U hker -d hker -f /tmp/migration.sql
"
```

### 3. Verify TLS certificate

ExternalDNS auto-creates the Cloudflare DNS record. cert-manager auto-issues TLS.

```bash
ssh root@82.22.63.196 "kubectl get certificate -n hker"
# Wait for READY=True (can take 1-2 minutes for DNS propagation)
```

---

## Useful Commands

```bash
# Cluster health
kubectl get nodes
kubectl get pods -A

# App status
kubectl get all -n hker
kubectl logs -n hker deployment/hker-app --tail=50
kubectl logs -n hker deployment/hker-db --tail=50

# Shell into app pod
kubectl exec -it -n hker deployment/hker-app -- sh

# Shell into DB pod
kubectl exec -it -n hker deployment/hker-db -- psql -U hker -d hker

# Port-forward for local debugging
kubectl port-forward -n hker svc/hker-app 3000:3000

# Tear down and rebuild
kubectl delete namespace hker
# Then re-apply from First-Time Setup
```

---

## Known Issues & Pitfalls

1. **arm64 vs amd64:** Always `--platform linux/amd64` when building on macOS ARM
2. **No Docker on server:** Use `k3s ctr images import` not `docker load`
3. **`imagePullPolicy: Never`:** Required for locally imported images
4. **SCP timeout for large files:** Use `cat file | ssh server "cat > file"` pipe method, or compress with gzip first
5. **Drizzle migrations not in Docker image:** Standalone build doesn't include `drizzle/` — use `kubectl cp` + `psql`
6. **Next.js needs env vars at build time:** `DATABASE_URL`, `APP_BASE_URL`, etc. must be `--build-arg` in Docker build
7. **HTTP 404 on port 80:** Traefik only routes websecure (443). HTTP returns 404 — this is correct
8. **Verify API endpoints, not just homepage:** A 200 on `/` doesn't guarantee the app works end-to-end

---

## Migration from CapRover

HKER was originally deployed on CapRover (Docker Swarm). Migrated to K3s on 2026-05-19 for better Kubernetes-native tooling (cert-manager, ExternalDNS, proper Ingress).

Key changes:
- Docker → containerd (`k3s ctr` instead of `docker`)
- CapRover nginx → Traefik Ingress
- Manual SSL → cert-manager with Cloudflare DNS-01
- Manual DNS → ExternalDNS auto-provisioning
- `drizzle-kit push` → explicit SQL migration files via `kubectl cp` + `psql`
