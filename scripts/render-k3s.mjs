import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const applying = process.argv.includes("--apply");
const safeName = (value, label) => {
  if (!/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(value) || value.length > 63)
    throw new Error(`${label} must be a DNS label`);
  return value;
};
const safeContext = (value) => {
  if (!/^[A-Za-z0-9._:@/-]{1,128}$/.test(value))
    throw new Error("HKER_KUBE_CONTEXT must be a configured context name without whitespace or flags");
  return value;
};
const environment = process.env.HKER_ENVIRONMENT ?? "staging";
if (!["staging", "production"].includes(environment))
  throw new Error("K3s render target must be staging or production");
const supplied = {
  namespace: process.env.HKER_NAMESPACE,
  image: process.env.HKER_IMAGE,
  origin: process.env.APP_BASE_URL,
  runtimeSecret: process.env.HKER_RUNTIME_SECRET,
  botSecret: process.env.HKER_BOT_SECRET,
  imagePullSecret: process.env.HKER_IMAGE_PULL_SECRET,
  context: process.env.HKER_KUBE_CONTEXT,
};
const mode = process.env.TELEGRAM_DELIVERY_MODE ?? "disabled";
if (applying && [supplied.namespace, supplied.image, supplied.origin, supplied.runtimeSecret, supplied.context].some((value) => !value))
  throw new Error("--apply requires HKER_NAMESPACE, HKER_IMAGE, APP_BASE_URL, HKER_RUNTIME_SECRET and HKER_KUBE_CONTEXT");
if (applying && mode === "live" && !supplied.botSecret)
  throw new Error("Live Bot rollout requires HKER_BOT_SECRET");
const exampleOnly = ![supplied.namespace, supplied.image, supplied.origin, supplied.runtimeSecret, supplied.context].every(Boolean) || (mode === "live" && !supplied.botSecret);
const namespace = safeName(supplied.namespace ?? "hker-staging-example", "HKER_NAMESPACE");
const runtimeSecret = safeName(supplied.runtimeSecret ?? "hker-staging-runtime-example", "HKER_RUNTIME_SECRET");
const botSecret = safeName(supplied.botSecret ?? "hker-staging-bot-example", "HKER_BOT_SECRET");
const imagePullSecret = supplied.imagePullSecret ? safeName(supplied.imagePullSecret, "HKER_IMAGE_PULL_SECRET") : null;
const imagePullSettings = imagePullSecret ? { imagePullSecrets: [{ name: imagePullSecret }] } : {};
const context = supplied.context ? safeContext(supplied.context) : null;
const image = supplied.image ?? "registry.example.invalid/hker:phase10-example-only";
if (image.includes(":latest") || !/^[\w./:@+-]+$/.test(image))
  throw new Error("HKER_IMAGE must be a safe immutable candidate reference, never :latest");
if (applying && !/@sha256:[a-f0-9]{64}$/.test(image))
  throw new Error("--apply requires a registry manifest digest (local Docker image IDs are not pullable)");
let origin;
try { origin = new URL(supplied.origin ?? "https://staging.example.invalid"); } catch { throw new Error("APP_BASE_URL must be an HTTPS origin"); }
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
  throw new Error("APP_BASE_URL must be an exact HTTPS origin");
if (!["disabled", "live"].includes(mode))
  throw new Error("K3s supports only disabled or live Bot mode; mock delivery is local/test only");
if (mode === "live" && !process.env.TELEGRAM_TEST_CHAT_ID && environment === "staging")
  throw new Error("Staging live delivery requires TELEGRAM_TEST_CHAT_ID configuration");
const candidate = safeName((process.env.HKER_CANDIDATE_ID ?? "local-candidate").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24), "HKER_CANDIDATE_ID");
const invocation = randomBytes(3).toString("hex");
const preflightJobName = safeName(`hker-preflight-${candidate.slice(-20)}-${invocation}`, "migration preflight job name");
const jobName = safeName(`hker-migrate-${candidate.slice(-20)}-${invocation}`, "migration job name");
const label = { "app.kubernetes.io/name": "hker-directory", "app.kubernetes.io/part-of": "hker-directory", "hker.directory/candidate": candidate };
const imageRef = image;
const config = {
  HKER_ENVIRONMENT: environment,
  HKER_CANDIDATE_ID: candidate,
  HKER_IMAGE_REF: imageRef,
  APP_BASE_URL: origin.origin,
  AUTH_SESSION_COOKIE_NAME: "__Host-hker_session",
  TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS ?? "false",
  TELEGRAM_DELIVERY_MODE: mode,
};
const fromConfig = Object.entries(config).map(([name, value]) => ({ name, value: String(value) }));
const fromRuntimeSecret = (name, key) => ({ name, valueFrom: { secretKeyRef: { name: runtimeSecret, key } } });
const fromBotSecret = (name, key, optional = false) => ({ name, valueFrom: { secretKeyRef: { name: botSecret, key, ...(optional ? { optional: true } : {}) } } });
const dbEnv = fromRuntimeSecret("DATABASE_URL", "DATABASE_URL");
const containers = {
  preflight: { name: "preflight", image, imagePullPolicy: "IfNotPresent", command: ["node", "ops/migrate.cjs"], env: [dbEnv, { name: "TELEGRAM_DELIVERY_MODE", value: "disabled" }], resources: { requests: { cpu: "50m", memory: "96Mi" }, limits: { cpu: "500m", memory: "512Mi" } } },
  migrate: { name: "migrate", image, imagePullPolicy: "IfNotPresent", command: ["node", "ops/migrate.cjs", "--apply"], env: [dbEnv, { name: "TELEGRAM_DELIVERY_MODE", value: "disabled" }], resources: { requests: { cpu: "50m", memory: "96Mi" }, limits: { cpu: "500m", memory: "512Mi" } } },
  web: {
    name: "web", image, imagePullPolicy: "IfNotPresent", ports: [{ name: "http", containerPort: 3000 }],
    env: [...fromConfig, fromRuntimeSecret("AUTH_SESSION_SECRET", "AUTH_SESSION_SECRET"), dbEnv,
      ...(mode === "live" ? [fromBotSecret("TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"), fromBotSecret("TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_WEBHOOK_SECRET"), ...(environment === "staging" ? [fromBotSecret("TELEGRAM_TEST_CHAT_ID", "TELEGRAM_TEST_CHAT_ID")] : [])] : [])],
    livenessProbe: { httpGet: { path: "/api/health", port: "http" }, initialDelaySeconds: 10, periodSeconds: 20, timeoutSeconds: 3, failureThreshold: 3 },
    readinessProbe: { httpGet: { path: "/api/ready", port: "http" }, periodSeconds: 10, timeoutSeconds: 3, failureThreshold: 3 },
    resources: { requests: { cpu: "100m", memory: "256Mi" }, limits: { cpu: "1", memory: "1Gi" } },
  },
  worker: {
    name: "worker", image, imagePullPolicy: "IfNotPresent", command: ["node", "ops/bot-runner.cjs", "--watch"],
    env: [...fromConfig, dbEnv, { name: "BOT_HEALTH_FILE", value: "/tmp/hker-worker-health" },
      ...(mode === "live" ? [fromBotSecret("TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"), ...(environment === "staging" ? [fromBotSecret("TELEGRAM_TEST_CHAT_ID", "TELEGRAM_TEST_CHAT_ID")] : [])] : [])],
    livenessProbe: { exec: { command: ["node", "-e", "const fs=require('node:fs');const p='/tmp/hker-worker-health';if(!fs.existsSync(p)||Date.now()-fs.statSync(p).mtimeMs>30000)process.exit(1)"] }, initialDelaySeconds: 20, periodSeconds: 10, timeoutSeconds: 3, failureThreshold: 3 },
    readinessProbe: { exec: { command: ["node", "-e", "const fs=require('node:fs');const p='/tmp/hker-worker-health';if(!fs.existsSync(p)||Date.now()-fs.statSync(p).mtimeMs>30000)process.exit(1)"] }, periodSeconds: 10, timeoutSeconds: 3, failureThreshold: 3 },
    resources: { requests: { cpu: "50m", memory: "128Mi" }, limits: { cpu: "500m", memory: "512Mi" } },
  },
  cleanup: {
    name: "cleanup", image, imagePullPolicy: "IfNotPresent", command: ["node", "ops/analytics-cleanup.cjs"],
    env: [...fromConfig, dbEnv],
    resources: { requests: { cpu: "50m", memory: "96Mi" }, limits: { cpu: "500m", memory: "512Mi" } },
  },
};
const object = (apiVersion, kind, name, spec, extra = {}) => ({ apiVersion, kind, metadata: { name, namespace, labels: label, ...extra.metadata }, ...(spec ? { spec } : {}), ...(extra.data ? { data: extra.data } : {}) });
const namespaceObject = { apiVersion: "v1", kind: "Namespace", metadata: { name: namespace, labels: label } };
const job = (name, container) => object("batch/v1", "Job", name, {
  backoffLimit: 0, activeDeadlineSeconds: 600, ttlSecondsAfterFinished: 604800,
  template: { metadata: { labels: { ...label, "app.kubernetes.io/component": container.name } }, spec: { ...imagePullSettings, restartPolicy: "Never", containers: [container] } },
});
const preflight = job(preflightJobName, containers.preflight);
const migration = object("batch/v1", "Job", jobName, {
  backoffLimit: 0, activeDeadlineSeconds: 600, ttlSecondsAfterFinished: 604800,
  template: { metadata: { labels: { ...label, "app.kubernetes.io/component": "migration" } }, spec: { ...imagePullSettings, restartPolicy: "Never", containers: [containers.migrate] } },
});
const runtime = [
  object("v1", "Service", "web", { type: "ClusterIP", selector: { "app.kubernetes.io/name": "hker-directory", "app.kubernetes.io/component": "web" }, ports: [{ name: "http", port: 3000, targetPort: "http" }] }),
  object("apps/v1", "Deployment", "web", { replicas: 1, selector: { matchLabels: { "app.kubernetes.io/name": "hker-directory", "app.kubernetes.io/component": "web" } }, template: { metadata: { labels: { ...label, "app.kubernetes.io/component": "web" } }, spec: { ...imagePullSettings, terminationGracePeriodSeconds: 30, containers: [containers.web] } } }),
  object("apps/v1", "Deployment", "worker", { replicas: mode === "disabled" ? 0 : 1, selector: { matchLabels: { "app.kubernetes.io/name": "hker-directory", "app.kubernetes.io/component": "worker" } }, template: { metadata: { labels: { ...label, "app.kubernetes.io/component": "worker" } }, spec: { ...imagePullSettings, terminationGracePeriodSeconds: 30, containers: [containers.worker] } } }),
  object("batch/v1", "CronJob", "cleanup", { schedule: "17 3 * * *", timeZone: "Asia/Hong_Kong", concurrencyPolicy: "Forbid", startingDeadlineSeconds: 900, successfulJobsHistoryLimit: 3, failedJobsHistoryLimit: 2, jobTemplate: { spec: { backoffLimit: 2, activeDeadlineSeconds: 600, template: { metadata: { labels: { ...label, "app.kubernetes.io/component": "cleanup" } }, spec: { ...imagePullSettings, restartPolicy: "Never", containers: [containers.cleanup] } } } } }),
];
const preflightDocs = [namespaceObject, preflight];
const migrationDocs = [migration];
const runtimeDocs = runtime;
const allDocs = [...preflightDocs, ...migrationDocs, ...runtimeDocs];
const validate = (docs) => {
  for (const doc of docs) {
    if (!doc.apiVersion || !doc.kind || !doc.metadata?.name) throw new Error("Rendered document is missing required Kubernetes identity fields");
    if (JSON.stringify(doc).includes("postgresql://")) throw new Error("Rendered manifest must reference database credentials through a Secret");
  }
  const jobs = docs.filter((doc) => doc.kind === "Job");
  if (!jobs.some((doc) => doc.metadata.name === preflightJobName) || !jobs.some((doc) => doc.metadata.name === jobName))
    throw new Error("Preflight and apply Jobs must be candidate/invocation-specific");
  if (docs.some((doc) => doc.kind === "Deployment" && doc.spec.template.spec.containers.some((container) => container.ports?.some((port) => port.containerPort === 3000) && container.livenessProbe.httpGet?.path !== "/api/health"))) throw new Error("Web liveness must use /api/health");
  if (docs.some((doc) => doc.kind === "CronJob" && doc.spec.concurrencyPolicy !== "Forbid")) throw new Error("Cleanup CronJob must prevent same-CronJob overlap");
};
validate(allDocs);
const directory = join("artifacts/release-candidate/k3s", `${candidate}-${Date.now()}-${randomBytes(3).toString("hex")}`);
await mkdir(directory, { recursive: true });
const writeBundle = async (name, docs) => {
  const path = join(directory, name);
  const content = `${docs.map((doc) => JSON.stringify(doc, null, 2)).join("\n---\n")}\n`;
  for (const document of content.split(/^---\s*$/m)) JSON.parse(document.trim());
  await writeFile(path, content, { mode: 0o600 });
  return path;
};
const preflightPath = await writeBundle("migration-preflight.yaml", preflightDocs);
const migrationPath = await writeBundle("migration-apply.yaml", migrationDocs);
const runtimePath = await writeBundle("runtime.yaml", runtimeDocs);
console.log(JSON.stringify({ status: "rendered_and_offline_validated", target: { environment, namespace, context: context ?? "unselected", image, candidate, origin: origin.origin, botMode: mode, runtimeSecret, botSecret: mode === "live" ? botSecret : null, imagePullSecret, webhookPath: "/api/telegram/webhook" }, exampleOnly, mutationRequested: applying, imagePullable: image.includes("@sha256:"), manifests: { preflight: preflightPath, migration: migrationPath, runtime: runtimePath }, checks: { resources: allDocs.map((doc) => `${doc.kind}/${doc.metadata.name}`), noCredentialValues: true, networkOrClusterContacted: false, serverAdmission: "not run" } }, null, 2));

if (applying) {
  if (!image.includes("@sha256:")) throw new Error("Refusing to apply a mutable image tag");
  const acknowledgements = {
    targetContext: process.env.HKER_CONFIRM_CONTEXT === context,
    targetNamespace: process.env.HKER_CONFIRM_NAMESPACE === namespace,
    targetImage: process.env.HKER_CONFIRM_IMAGE === image,
    targetOrigin: process.env.HKER_CONFIRM_ORIGIN === origin.origin,
    candidateMigrationPreflight: process.env.HKER_PREFLIGHTED_MIGRATION_CANDIDATE === candidate,
    candidateMigrationReview: process.env.HKER_REVIEWED_MIGRATION_CANDIDATE === candidate,
    verifiedBackup: process.env.HKER_BACKUP_VERIFIED === "I_VERIFIED_A_SEPARATE_RESTOREABLE_BACKUP",
    writersQuiesced: process.env.HKER_WRITERS_QUIESCED === "I_QUIESCED_WRITERS_AND_BOT_WORKER",
    applyAuthorization: process.env.HKER_K3S_APPLY_ACK === "APPLY_REVIEWED_MIGRATION_THEN_RUNTIME",
  };
  const missingAcknowledgements = Object.entries(acknowledgements).filter(([, ok]) => !ok).map(([name]) => name);
  if (missingAcknowledgements.length)
    throw new Error(`--apply refused; exact target, candidate migration preflight/review, backup, quiesce and mutation acknowledgements are required: ${missingAcknowledgements.join(", ")}`);
  const available = spawnSync("kubectl", ["config", "get-contexts", "-o", "name"], { encoding: "utf8" });
  if (available.status !== 0 || !available.stdout.split(/\r?\n/).includes(context))
    throw new Error("The confirmed Kubernetes context is not present in the local kubeconfig");
  console.log(`Applying target context=${context} namespace=${namespace} image=${image} candidate=${candidate} origin=${origin.origin} botMode=${mode} runtimeSecret=${runtimeSecret} botSecret=${mode === "live" ? botSecret : "not used"}; actions=apply namespace plus read-only preflight Job, wait for success, apply candidate migration Job, wait for success, then apply Web/worker/CronJob`);
  const run = (args) => {
    const result = spawnSync("kubectl", ["--context", context, ...args], { encoding: "utf8", stdio: "inherit" });
    if (result.status !== 0) throw new Error(`kubectl ${args[0]} failed with status ${result.status ?? "unknown"}`);
  };
  run(["apply", "-f", preflightPath]);
  run(["wait", "--namespace", namespace, `job/${preflightJobName}`, "--for=condition=complete", "--timeout=10m"]);
  run(["apply", "-f", migrationPath]);
  run(["wait", "--namespace", namespace, `job/${jobName}`, "--for=condition=complete", "--timeout=10m"]);
  run(["apply", "-f", runtimePath]);
  console.log(JSON.stringify({ status: "applied_and_migration_passed", target: { environment, namespace, context, image, candidate }, preflightJob: preflightJobName, migrationJob: jobName, runtimeApplied: true }, null, 2));
}
