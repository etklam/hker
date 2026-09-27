import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Use Node 24 (.nvmrc) for ops:rehearsal");
if (process.env.DATABASE_URL)
  throw new Error("Unset DATABASE_URL; ops:rehearsal never accepts an external database target");

const repository = process.cwd();
const startedAt = new Date().toISOString();
const runSuffix = randomBytes(3).toString("hex");
const artifactDir = join(repository, "artifacts/release-candidate/phase10", `${startedAt.replace(/[^0-9]/g, "").slice(0, 14)}-${runSuffix}`);
const git = (...args) => runSync("git", args).stdout.trim();
function runSync(program, args) {
  const result = spawnSync(program, args, { cwd: repository, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${program} ${args[0] ?? ""} failed`);
  return result;
}
const sourceFiles = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).sort();
const treeHash = createHash("sha256");
for (const path of sourceFiles) {
  treeHash.update(`${path}\0`);
  try { treeHash.update(readFileSync(join(repository, path))); } catch { treeHash.update("[deleted]"); }
}
const treeSha = treeHash.digest("hex");
const commit = git("rev-parse", "HEAD");
const dirty = git("status", "--short");
const patchSha = createHash("sha256").update(git("diff", "--binary", "HEAD")).digest("hex");
const lockSha = createHash("sha256").update(readFileSync("package-lock.json")).digest("hex");
const migrationHash = createHash("sha256");
for (const path of [...sourceFiles.filter((file) => file.startsWith("drizzle/") && file.endsWith(".sql")), "drizzle/meta/_journal.json"].sort()) {
  migrationHash.update(`${path}\0`);
  migrationHash.update(readFileSync(path));
}
const migrationSha = migrationHash.digest("hex");
const platform = process.env.HKER_PLATFORM ?? (process.arch === "arm64" ? "linux/arm64" : process.arch === "x64" ? "linux/amd64" : "");
if (!["linux/amd64", "linux/arm64"].includes(platform)) throw new Error("Set HKER_PLATFORM to linux/amd64 or linux/arm64");
const candidate = `sha-${commit.slice(0, 10)}-tree-${treeSha.slice(0, 10)}`;
const image = `hker:phase10-${commit.slice(0, 8)}-${treeSha.slice(0, 8)}-${runSuffix}`;
const predecessorImage = `hker:predecessor-${commit.slice(0, 8)}-${treeSha.slice(0, 8)}-${runSuffix}`;
const project = `hker-p10-${treeSha.slice(0, 7)}-${randomBytes(2).toString("hex")}`;
const migrationFailureProject = `${project}-migfail`;
const schemaFailureProject = `${project}-schema`;
const privateDir = await mkdtemp(join(tmpdir(), "hker-phase10-"));
await chmod(privateDir, 0o700);
await mkdir(artifactDir, { recursive: true });
const generated = {
  dbPassword: randomBytes(24).toString("hex"),
  sessionSecret: randomBytes(48).toString("base64url"),
  webhookSecret: randomBytes(32).toString("base64url"),
  adminEmail: `phase10-${randomBytes(5).toString("hex")}@example.test`,
  adminPassword: `Fictional-${randomBytes(24).toString("base64url")}!`,
};
const secrets = Object.values(generated);
const sanitize = (value) => {
  let output = String(value);
  for (const secret of secrets) output = output.replaceAll(secret, "[redacted]");
  return output.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]")
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[redacted]");
};
const dockerEnvironment = { ...process.env };
for (const key of Object.keys(dockerEnvironment))
  if (/^(DATABASE_URL|POSTGRES_|AUTH_|ADMIN_|TELEGRAM_|BOT_|DIRECTORY_|HKER_|COMPOSE_|APP_BASE_URL$|TRUST_PROXY_HEADERS$|ANALYTICS_ACTION_SECRET$)/.test(key))
    delete dockerEnvironment[key];
dockerEnvironment.COMPOSE_ANSI = "never";

async function reservePort() {
  for (;;) {
    const server = createServer();
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No loopback port available");
    const port = address.port;
    await new Promise((resolve) => server.close(resolve));
    if (!usedPorts.has(port)) { usedPorts.add(port); return port; }
  }
}
const usedPorts = new Set();
const mainEnv = join(privateDir, "rehearsal.env");
const bootstrapEnv = join(privateDir, "bootstrap.env");
const migrationFailEnv = join(privateDir, "migration-failure.env");
const schemaFailEnv = join(privateDir, "schema-failure.env");
let databasePort, webPort, migrationFailurePort, schemaFailurePort, negativeWebPort;
const stages = [];
let composeProjectCreated = false;
let teardownComplete = false;
let failureReport = null;
const composeBase = (name, envFile, profile = "rehearsal", moreEnvFiles = []) => [
  "compose", "--project-name", name, "--file", "docker-compose.yml",
  ...[envFile, ...moreEnvFiles].flatMap((file) => ["--env-file", file]), "--profile", profile,
];
function command(program, args, { allowFailure = false, timeout = 120_000, label = args[0] ?? program, input, env = dockerEnvironment } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: repository, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => {
      clearTimeout(timer);
      const result = { status: status ?? 1, stdout: sanitize(stdout), stderr: sanitize(stderr), label };
      const commandArgs = args.map((part, index) => {
        if (args[index - 1] === "-c") return "[query]";
        if (part.startsWith("/private/") || part.startsWith("/var/folders/")) return "[private-env-file]";
        return part;
      });
      stages.push({ command: `${program} ${commandArgs.join(" ")}`, exitCode: result.status, label });
      if (result.status !== 0 && !allowFailure) reject(new Error(`${label} failed with status ${result.status}: ${sanitize(stderr || stdout).slice(-1800)}`));
      else resolve(result);
    });
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}
async function recordLog(name, result) {
  await writeFile(join(artifactDir, name), `${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}`, { mode: 0o600 });
}
async function compose(name, envFile, profile, args, options = {}) {
  const envFiles = options.envFiles ?? [];
  const result = await command("docker", [...composeBase(name, envFile, profile, envFiles), ...args], { ...options, label: options.label ?? `compose:${name}:${args[0]}` });
  const suffix = result.status === 0 ? args[0] : `failed-${args[0]}`;
  await recordLog(`${name}-${suffix}.log`, result);
  return result;
}
async function writeEnv(path, values) {
  await writeFile(path, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}
async function inspectMigrationContainer(name, envFile) {
  const result = await compose(name, envFile, "rehearsal", ["ps", "-a", "-q", "migrate"], { label: `inspect ${name} migration container` });
  const id = result.stdout.trim().split("\n").filter(Boolean).at(-1);
  if (!id) throw new Error(`No migration container recorded for ${name}`);
  const inspected = await command("docker", ["inspect", "--format", "{{.Id}}|{{.Image}}|{{.State.ExitCode}}", id], { label: "inspect candidate migration identity" });
  return inspected.stdout.trim().split("|");
}
async function waitHttp(url, expectedStatus, label, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < end) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2500) }); lastStatus = response.status; if (lastStatus === expectedStatus) return response; }
    catch { /* Wait for the disposable web service. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${label} expected HTTP ${expectedStatus}, last response ${lastStatus}`);
}
async function expectHttp(url, expectedStatus, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  if (response.status !== expectedStatus) throw new Error(`${new URL(url).pathname} expected HTTP ${expectedStatus}, received ${response.status}`);
  return response;
}
async function composeExec(name, envFile, commandArgs, input) {
  return command("docker", [...composeBase(name, envFile), "exec", "-T", ...commandArgs], { input, label: `compose exec ${commandArgs[0]}` });
}
async function composeSql(name, envFile, sqlText) {
  return composeExec(name, envFile, ["db", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "hker_rehearsal", "-d", "hker_directory_test", "-tA", "-f", "-"], sqlText);
}
function parseJsonObject(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Command did not emit a JSON object");
  return JSON.parse(output.slice(start, end + 1));
}
async function teardownOwnedProjects() {
  if (teardownComplete) return;
  for (const [name, envFile, profile] of [[schemaFailureProject, schemaFailEnv, "negative"], [migrationFailureProject, migrationFailEnv, "rehearsal"], [project, mainEnv, "rehearsal"]]) {
    await command("docker", [...composeBase(name, envFile, profile), "down", "--volumes", "--remove-orphans"], { timeout: 60_000, label: `teardown owned project ${name}` });
  }
  teardownComplete = true;
}

let summary;
try {
  databasePort = await reservePort();
  webPort = await reservePort();
  migrationFailurePort = await reservePort();
  schemaFailurePort = await reservePort();
  negativeWebPort = await reservePort();
  const base = {
    HKER_IMAGE: image,
    HKER_CANDIDATE_ID: candidate,
    HKER_DEV_DB_PORT: databasePort,
    HKER_REHEARSAL_WEB_PORT: webPort,
    POSTGRES_DB: "hker_directory_test",
    POSTGRES_USER: "hker_rehearsal",
    POSTGRES_PASSWORD: generated.dbPassword,
    AUTH_SESSION_SECRET: generated.sessionSecret,
    HKER_REHEARSAL_WEBHOOK_SECRET: generated.webhookSecret,
    HKER_ENVIRONMENT: "local",
    APP_BASE_URL: `http://127.0.0.1:${webPort}`,
    AUTH_SESSION_COOKIE_NAME: "hker_rehearsal_session",
    TELEGRAM_DELIVERY_MODE: "mock",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_WEBHOOK_SECRET: generated.webhookSecret,
    TELEGRAM_TEST_CHAT_ID: "",
    TRUST_PROXY_HEADERS: "false",
    DIRECTORY_ANALYTICS_ENABLED: "false",
  };
  await writeEnv(mainEnv, base);
  await writeEnv(bootstrapEnv, { ADMIN_EMAIL: generated.adminEmail, ADMIN_PASSWORD: generated.adminPassword, ADMIN_NAME: "HKER Fictional Phase 10 Admin" });

  const build = await command("docker", ["build", "--platform", platform, "--label", `org.opencontainers.image.revision=${commit}`, "--label", `io.hker.source.tree.sha256=${treeSha}`, "--label", `io.hker.lockfile.sha256=${lockSha}`, "--label", `io.hker.migrations.sha256=${migrationSha}`, "--build-arg", `HKER_COMMIT=${commit}`, "--build-arg", `HKER_TREE_SHA256=${treeSha}`, "--build-arg", `HKER_LOCKFILE_SHA256=${lockSha}`, "--build-arg", `HKER_MIGRATION_SHA256=${migrationSha}`, "-t", image, "."], { timeout: 900_000, label: "build candidate image once" });
  await recordLog("docker-build.log", build);
  const inspectedImage = await command("docker", ["image", "inspect", image, "--format", "{{.Id}}"], { label: "inspect candidate local image id" });
  const imageId = inspectedImage.stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error("Docker did not return a local image ID");

  const predecessorArchive = spawnSync("git", ["archive", "--format=tar", commit], {
    cwd: repository,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (predecessorArchive.status !== 0 || !predecessorArchive.stdout)
    throw new Error("Could not prepare the committed Phase 9 predecessor source archive");
  const predecessorBuild = await command("docker", ["build", "--platform", platform, "-t", predecessorImage, "-"], {
    input: predecessorArchive.stdout,
    timeout: 900_000,
    label: "build committed predecessor for forward-schema rollback compatibility",
  });
  await recordLog("predecessor-build.log", predecessorBuild);
  const predecessorInfo = await command("docker", ["image", "inspect", predecessorImage, "--format", "{{.Id}}"], { label: "inspect predecessor image" });
  const predecessorImageId = predecessorInfo.stdout.trim();

  const manifest = {
    status: "building",
    candidate,
    commit,
    branch: git("branch", "--show-current"),
    workingTree: dirty ? "dirty local candidate" : "clean",
    treeSha256: treeSha,
    patchSha256: patchSha,
    lockfileSha256: lockSha,
    migrationSetSha256: migrationSha,
    runtime: { node: process.version, platform, dockerImagePlatform: platform },
    image: { reference: image, localImageId: imageId, registryManifestDigest: null, multiPlatformIndexDigest: null, pullableFromRegistry: false },
    predecessor: { commit, image: predecessorImage, localImageId: predecessorImageId, role: "committed Phase 9 rollback compatibility fixture" },
    evidenceDirectory: artifactDir,
    startedAt,
    externalEnvironment: { databaseUrlAccepted: false, telegram: "mock only", tokenForwarded: false },
    stages,
  };
  await writeFile(join(artifactDir, "candidate-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const common = { ...base, HKER_IMAGE: image, HKER_CANDIDATE_ID: candidate };
  await compose(project, mainEnv, "rehearsal", ["up", "-d", "--wait", "--wait-timeout", "60", "db"], { timeout: 90_000, label: "start isolated disposable PostgreSQL" });
  const migrationAcceptanceUrl = `postgresql://${base.POSTGRES_USER}:${base.POSTGRES_PASSWORD}@127.0.0.1:${databasePort}/hker_directory_test`;
  const migrationAcceptance = await command(process.execPath, ["scripts/migration-acceptance.mjs"], {
    env: { ...dockerEnvironment, DATABASE_URL: migrationAcceptanceUrl, ALLOW_DIRECTORY_TEST_RESET: "1" },
    timeout: 180_000,
    label: "fresh and supported-upgrade migration acceptance on isolated loopback PostgreSQL",
  });
  await recordLog("migration-acceptance.log", migrationAcceptance);
  const migrationReport = JSON.parse(migrationAcceptance.stdout.trim().split("\n").at(-1));
  if (migrationReport.status !== "passed") throw new Error("Fresh/upgrade migration acceptance did not pass");
  await compose(project, mainEnv, "rehearsal", ["up", "--no-deps", "--force-recreate", "--exit-code-from", "migrate", "migrate"], { timeout: 120_000, label: "apply candidate migrations in disposable project" });
  composeProjectCreated = true;
  const firstMigration = await inspectMigrationContainer(project, mainEnv);
  await compose(project, mainEnv, "rehearsal", ["up", "--no-deps", "--force-recreate", "--exit-code-from", "migrate", "migrate"], { timeout: 120_000, label: "force a fresh candidate-specific migration attempt" });
  const secondMigration = await inspectMigrationContainer(project, mainEnv);
  if (firstMigration[0] === secondMigration[0] || secondMigration[1] !== imageId || Number(secondMigration[2]) !== 0)
    throw new Error("A stale successful migration container was not replaced by the current candidate image");

  const firstBootstrap = await compose(project, mainEnv, "rehearsal", ["run", "--rm", "bootstrap"], { envFiles: [bootstrapEnv], label: "create fictional administrator once" });
  if (!firstBootstrap.stdout.includes("Administrator created")) throw new Error("Candidate image did not create the fictional administrator");
  const secondBootstrap = await compose(project, mainEnv, "rehearsal", ["run", "--rm", "bootstrap"], { envFiles: [bootstrapEnv], allowFailure: true, label: "assert bootstrap refuses existing account" });
  if (secondBootstrap.status === 0 || !`${secondBootstrap.stdout}${secondBootstrap.stderr}`.includes("no changes made"))
    throw new Error("A second bootstrap did not refuse existing account reuse");
  await rm(bootstrapEnv, { force: true });

  await compose(project, mainEnv, "rehearsal", ["up", "-d", "--wait", "--wait-timeout", "90", "web", "worker"], { timeout: 150_000, label: "start candidate Web and watch worker" });
  const baseUrl = `http://127.0.0.1:${webPort}`;
  await waitHttp(`${baseUrl}/api/health`, 200, "candidate liveness");
  await waitHttp(`${baseUrl}/api/ready`, 200, "candidate readiness");
  const workerIds = (await compose(project, mainEnv, "rehearsal", ["ps", "-q", "worker"], { label: "get candidate worker container" })).stdout.trim().split("\n").filter(Boolean);
  if (workerIds.length !== 1) throw new Error("Expected exactly one candidate worker");
  const workerHealth = (await command("docker", ["inspect", "--format", "{{.State.Health.Status}}", workerIds[0]], { label: "check role-specific worker health" })).stdout.trim();
  if (workerHealth !== "healthy") throw new Error("Worker health was not its process-local heartbeat");

  const bootstrapCookie = async () => {
    const response = await expectHttp(`${baseUrl}/api/auth/login`, 200, {
      method: "POST", headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email: generated.adminEmail, password: generated.adminPassword }),
    });
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("Admin login did not issue a session");
    const session = await expectHttp(`${baseUrl}/api/auth/session`, 200, { headers: { cookie } });
    if (!(await session.json()).authenticated) throw new Error("Candidate Admin session was not authenticated");
    return cookie;
  };
  const cookie = await bootstrapCookie();
  const adminRequest = async (path, body, method = "POST") => {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json", origin: baseUrl, cookie }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Admin ${path} failed with HTTP ${response.status}`);
    return value;
  };
  const suffix = randomBytes(3).toString("hex");
  const category = await adminRequest("/api/admin/catalog", { kind: "categories", data: { name: `虛構演練分類 ${suffix}`, slug: `phase10-category-${suffix}` } });
  const area = await adminRequest("/api/admin/catalog", { kind: "areas", data: { name: `虛構演練地區 ${suffix}`, slug: `phase10-area-${suffix}` } });
  const tag = await adminRequest("/api/admin/catalog", { kind: "tags", data: { name: `虛構演練標籤 ${suffix}`, slug: `phase10-tag-${suffix}` } });
  const fixtures = [
    { name: `虛構網站測試收錄 ${suffix}`, links: [{ type: "website", label: "虛構網站", url: `https://fixture-${suffix}.example.test/` }, { type: "website", label: "第二虛構網站", url: `https://second-${suffix}.example.test/` }], priceMin: 100, priceMax: 250, areaId: area.id },
    { name: `虛構 Telegram 測試收錄 ${suffix}`, links: [{ type: "telegram", label: "虛構 Telegram", url: `https://t.me/hker_fixture_${suffix}` }], priceMin: null, priceMax: null, areaId: area.id },
    { name: `虛構無外連測試收錄 ${suffix}`, links: [], priceMin: null, priceMax: null, areaId: area.id },
    { name: `虛構無地區測試收錄 ${suffix}`, links: [], priceMin: null, priceMax: null, areaId: null },
    { name: `虛構未知價格測試收錄 ${suffix}`, links: [], priceMin: null, priceMax: null, areaId: area.id },
    { name: `虛構零價格測試收錄 ${suffix}`, links: [], priceMin: 0, priceMax: 0, areaId: area.id },
    { name: `虛構一般範圍測試收錄 ${suffix}`, links: [], priceMin: 80, priceMax: 220, areaId: area.id },
  ];
  const created = [];
  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index];
    created.push(await adminRequest("/api/admin/catalog", { kind: "listings", data: {
      name: fixture.name,
      slug: `phase10-${index}-${suffix}`,
      shortDescription: "Fictional disposable rehearsal fixture",
      categoryId: category.id,
      areaId: fixture.areaId,
      tagIds: [tag.id],
      priceMin: fixture.priceMin,
      priceMax: fixture.priceMax,
      priceCurrency: "HKD",
      enabled: true,
      links: fixture.links,
    } }));
  }
  const csv = `name,slug,shortDescription\n"${fixtures[0].name}",phase10-import-${suffix},"Fictional reviewed import"`;
  const preview = await adminRequest("/api/admin/catalog/operations", { action: "import", source: csv, settings: { mode: "create", decisions: { "2": "accept" } } });
  if (!preview.payload?.rows?.[0]?.warnings?.some((warning) => warning.includes("名稱與既有")))
    throw new Error("Import preview did not expose the fictional duplicate warning for operator review");
  const imported = await adminRequest("/api/admin/catalog/operations", { action: "commit", id: preview.id, digest: preview.digest });
  const importedListing = imported.affected?.[0];
  const importedId = importedListing?.id;
  if (!importedId) throw new Error("Reviewed import did not return its new Listing identity");
  if (importedListing.enabled !== false) throw new Error("A newly imported Listing must remain unpublished until explicit review");
  const exported = await expectHttp(`${baseUrl}/api/admin/catalog/export?format=json&ids=${created[0].id},${importedId}`, 200, { headers: { cookie } });
  const exportedText = await exported.text();
  if (!exportedText.includes(fixtures[0].name) || !exportedText.includes(`phase10-import-${suffix}`))
    throw new Error("Admin export did not include the selected fictional listings");

  const beforeImportPublication = await (await expectHttp(`${baseUrl}/api/catalog?pageSize=100`, 200)).json();
  const privateImportVisible = beforeImportPublication.items.some((item) => item.slug === `phase10-import-${suffix}`);
  if (privateImportVisible || !beforeImportPublication.items.some((item) => item.slug === `phase10-0-${suffix}`))
    throw new Error("Public discovery violated the reviewed import publication boundary");
  await adminRequest("/api/admin/catalog", { action: "publish", kind: "listings", id: importedId, enabled: true, revision: importedListing.revision }, "PATCH");
  const publicResponse = await expectHttp(`${baseUrl}/api/catalog?pageSize=100`, 200);
  const publicCatalog = await publicResponse.json();
  const visible = new Set(publicCatalog.items.map((item) => item.slug));
  if (!visible.has(`phase10-0-${suffix}`) || !visible.has(`phase10-import-${suffix}`))
    throw new Error("Public discovery did not return enabled fictional rehearsal listings");
  const firstPublic = publicCatalog.items.find((item) => item.slug === `phase10-0-${suffix}`);
  if (firstPublic.links.length !== 2 || firstPublic.links[0].type !== "website")
    throw new Error("Public HTTP response did not preserve repeated external links");
  await adminRequest("/api/admin/catalog", { action: "publish", kind: "listings", id: created[0].id, enabled: false, revision: created[0].revision }, "PATCH");
  const afterUnpublish = await (await expectHttp(`${baseUrl}/api/catalog?pageSize=100`, 200)).json();
  if (afterUnpublish.items.some((item) => item.slug === `phase10-0-${suffix}`))
    throw new Error("An unpublished rehearsal listing remained public");
  const analyticsResponse = await expectHttp(`${baseUrl}/api/admin/analytics`, 200, { headers: { cookie } });
  const analyticsReport = await analyticsResponse.json();
  if (analyticsReport.collection?.status !== "disabled")
    throw new Error("Disabling optional analytics affected the discovery runtime or was not reported");

  const webhookPath = `${baseUrl}/api/telegram/webhook`;
  const updateId = 1_700_000_000 + Math.floor(Math.random() * 200_000_000);
  const update = { update_id: updateId, message: { text: "/help", chat: { id: 1_200_000_000 + Math.floor(Math.random() * 100_000_000) }, from: { id: 1_100_000_000 + Math.floor(Math.random() * 100_000_000) } } };
  await expectHttp(webhookPath, 401, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" }, body: JSON.stringify(update) });
  await expectHttp(webhookPath, 200, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": generated.webhookSecret }, body: JSON.stringify(update) });
  const botDelivery = await waitForBotCompletion(project, mainEnv, updateId);

  const staleJobId = updateId + 1;
  const activeJobId = updateId + 2;
  await composeSql(project, mainEnv, `
    insert into directory_bot_sessions (key, state, updated_at)
    values ('phase10-stale-${suffix}:1', '{}'::jsonb, now() - interval '8 days');
    insert into directory_bot_chat_leases (key, updated_at)
    values ('phase10-stale-${suffix}', now() - interval '8 days');
    insert into directory_bot_updates
      (id, conversation_key, chat_key, status, operations, next_operation, completed_at, created_at, updated_at)
    values (${staleJobId}, 'phase10-stale-${suffix}:1', 'phase10-stale-${suffix}', 'complete',
      '[{"method":"sendMessage","body":{"text":"fictional expired fixture"}}]'::jsonb,
      1, now() - interval '31 days', now() - interval '32 days', now() - interval '31 days');
    insert into directory_bot_sessions (key, state, locked_until)
    values ('phase10-active-${suffix}:1', '{}'::jsonb, now() + interval '1 hour');
    insert into directory_bot_chat_leases (key, locked_until)
    values ('phase10-active-${suffix}', now() + interval '1 hour');
    insert into directory_bot_updates
      (id, conversation_key, chat_key, status, operations, next_operation, lease_owner, locked_until)
    values (${activeJobId}, 'phase10-active-${suffix}:1', 'phase10-active-${suffix}', 'pending',
      '[]'::jsonb, 0, 'synthetic-active-owner', now() + interval '1 hour');
    insert into directory_content_plans (id, actor_id, kind, digest, payload, expires_at, created_at)
    select 'phase10-expired-plan-${suffix}', id, 'bulk', 'phase10-expired-${suffix}', '{}'::jsonb,
      now() - interval '1 day', now() - interval '2 days'
    from users where email = '${generated.adminEmail}';
    insert into directory_content_plans (id, actor_id, kind, digest, payload, expires_at)
    select 'phase10-active-plan-${suffix}', id, 'bulk', 'phase10-active-${suffix}', '{}'::jsonb,
      now() + interval '1 day'
    from users where email = '${generated.adminEmail}';
    insert into directory_content_history (id, actor_id, entity, entity_id, action, changes, created_at)
    select 'phase10-expired-history-${suffix}', id, 'listing', ${created[0].id}, 'update', '{}'::jsonb,
      now() - interval '91 days'
    from users where email = '${generated.adminEmail}';
    insert into directory_event_days (day, source, kind, key, count, zero_count)
    values (current_date - 91, 'web', 'search', 'phase10-retention-${suffix}', 1, 1);
    insert into directory_event_receipts (id, created_at)
    values ('phase10-expired-receipt-${suffix}', now() - interval '8 days');
    insert into directory_maintenance_runs (id, kind, status, started_at, finished_at, counts)
    values ('phase10-expired-maintenance-${suffix}', 'retention', 'succeeded',
      now() - interval '92 days', now() - interval '91 days', '{"bot.jobs":1}'::jsonb);
  `);

  const beforeCleanup = await compose(project, mainEnv, "rehearsal", ["run", "--rm", "--no-deps", "cleanup"], { label: "run bundled bounded cleanup against aged synthetic fixtures" });
  const firstCleanupResult = JSON.parse(beforeCleanup.stdout.trim().split("\n").at(-1));
  const afterCleanup = await compose(project, mainEnv, "rehearsal", ["run", "--rm", "--no-deps", "cleanup"], { label: "retry bundled bounded cleanup" });
  const cleanupResult = JSON.parse(afterCleanup.stdout.trim().split("\n").at(-1));
  const retainedState = JSON.parse((await composeSql(project, mainEnv, `
    select json_build_object(
      'activeJob', (select json_build_object('status', status, 'owner', lease_owner, 'locked', locked_until > now()) from directory_bot_updates where id=${activeJobId}),
      'activePlan', (select count(*) from directory_content_plans where id='phase10-active-plan-${suffix}'),
      'staleJob', (select count(*) from directory_bot_updates where id=${staleJobId}),
      'stalePlan', (select count(*) from directory_content_plans where id='phase10-expired-plan-${suffix}'),
      'staleHistory', (select count(*) from directory_content_history where id='phase10-expired-history-${suffix}'),
      'staleAggregate', (select count(*) from directory_event_days where key='phase10-retention-${suffix}'),
      'staleReceipt', (select count(*) from directory_event_receipts where id='phase10-expired-receipt-${suffix}'),
      'staleMaintenance', (select count(*) from directory_maintenance_runs where id='phase10-expired-maintenance-${suffix}')
    )::text;
  `)).stdout.trim());
  const firstDeleted = firstCleanupResult.deleted ?? {};
  if (firstCleanupResult.status !== "succeeded" || cleanupResult.status !== "succeeded")
    throw new Error("Repeated cleanup did not complete idempotently");
  if (firstDeleted["bot.jobs"] < 1 || firstDeleted["content.plans"] < 1 || firstDeleted["content.history"] < 1 || firstDeleted["analytics.aggregates"] < 1 || firstDeleted["analytics.receipts"] < 1 || firstDeleted["maintenance.runs"] < 1)
    throw new Error("Cleanup did not report deletion of each aged synthetic record category");
  if (retainedState.activeJob?.status !== "pending" || retainedState.activeJob?.owner !== "synthetic-active-owner" || !retainedState.activeJob?.locked || retainedState.activePlan !== 1 || Object.values(retainedState).slice(2).some((count) => count !== 0))
    throw new Error("Cleanup removed active work or failed to remove expired synthetic records");
  if (Object.values(cleanupResult.deleted ?? {}).some((count) => count !== 0))
    throw new Error("Repeated cleanup was not idempotent");
  const doctor = await compose(project, mainEnv, "rehearsal", ["run", "--rm", "--no-deps", "doctor"], { label: "read-only candidate doctor" });
  const doctorReport = parseJsonObject(doctor.stdout);
  if (doctorReport.status !== "ready" || doctorReport.telegram.mode !== "mock" || doctorReport.cleanup.status !== "succeeded")
    throw new Error("Read-only doctor did not report schema, mock worker configuration and cleanup evidence");

  const runtime = await command(process.execPath, [
    "scripts/rc-runtime-rehearsal.mjs",
    `--image=${image}`,
    `--predecessor-image=${predecessorImage}`,
    `--evidence-dir=${artifactDir}`,
  ], {
    env: {
      ...dockerEnvironment,
      ALLOW_DIRECTORY_TEST_RESET: "1",
      DATABASE_URL: "",
      TELEGRAM_DELIVERY_MODE: "mock",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_WEBHOOK_SECRET: "",
    },
    timeout: 900_000,
    label: "built-image database outage, backup/restore, and predecessor compatibility rehearsal",
  });
  await recordLog("runtime-restore-upgrade.log", runtime);
  const runtimeReport = parseJsonObject(runtime.stdout);
  if (runtimeReport.status !== "passed" || runtimeReport.predecessorCompatibility?.status !== "passed")
    throw new Error("Built-image restore or committed-predecessor compatibility rehearsal did not pass");

  const migrationFailureEnv = { ...common, HKER_DEV_DB_PORT: migrationFailurePort, HKER_MIGRATION_DATABASE_URL: `postgresql://${base.POSTGRES_USER}:${base.POSTGRES_PASSWORD}@db:5432/hker_missing_database` };
  await writeEnv(migrationFailEnv, migrationFailureEnv);
  await compose(migrationFailureProject, migrationFailEnv, "rehearsal", ["up", "-d", "--wait", "--wait-timeout", "60", "db"], { timeout: 90_000, label: "start failed-migration disposable DB" });
  const failedMigration = await compose(migrationFailureProject, migrationFailEnv, "rehearsal", ["up", "--no-deps", "--force-recreate", "--exit-code-from", "migrate", "migrate"], { allowFailure: true, label: "negative failed migration gate" });
  const refusedRollout = await compose(migrationFailureProject, migrationFailEnv, "rehearsal", ["up", "-d", "web", "worker"], { allowFailure: true, label: "assert failed migration refuses Web/worker rollout" });
  const workloadIds = await compose(migrationFailureProject, migrationFailEnv, "rehearsal", ["ps", "-a", "-q", "web", "worker"], { label: "inspect failed-migration workload containers" });
  const workloadStates = workloadIds.stdout.trim()
    ? await command("docker", ["inspect", "--format", "{{.State.Status}}", ...workloadIds.stdout.trim().split(/\s+/)], { label: "verify failed-migration workloads stayed stopped" })
    : { stdout: "" };
  if (failedMigration.status === 0 || refusedRollout.status === 0 || workloadStates.stdout.trim().split("\n").some((state) => state === "running"))
    throw new Error("Failed migration did not block candidate Web/worker startup");

  const schemaFailure = { ...common, HKER_DEV_DB_PORT: schemaFailurePort, HKER_NEGATIVE_WEB_PORT: negativeWebPort };
  await writeEnv(schemaFailEnv, schemaFailure);
  await compose(schemaFailureProject, schemaFailEnv, "negative", ["up", "-d", "--wait", "--wait-timeout", "60", "db", "schema-negative-web"], { timeout: 120_000, label: "start candidate against fresh incompatible schema" });
  const negativeUrl = `http://127.0.0.1:${negativeWebPort}`;
  await waitHttp(`${negativeUrl}/api/health`, 200, "negative-schema liveness");
  await waitHttp(`${negativeUrl}/api/ready`, 503, "negative-schema readiness");
  const workerConfigured = await compose(project, mainEnv, "rehearsal", ["ps", "-q", "worker"], { label: "verify watch worker remains single replica" });
  if (!workerConfigured.stdout.trim()) throw new Error("Candidate watch worker is not running");

  const badConfiguration = await command("docker", ["run", "--rm", image, "node", "ops/runtime-env.cjs"], { allowFailure: true, label: "negative missing configuration refusal" });
  if (badConfiguration.status === 0 || !`${badConfiguration.stdout}${badConfiguration.stderr}`.includes("Missing required configuration"))
    throw new Error("Candidate image did not reject missing mandatory runtime configuration");
  await recordLog("negative-configuration.log", badConfiguration);

  const imageInfo = await command("docker", ["image", "inspect", image, "--format", "{{.Os}}/{{.Architecture}}"], { label: "candidate image runtime platform" });
  const pgInfo = await composeExec(project, mainEnv, ["db", "psql", "-X", "-q", "-U", base.POSTGRES_USER, "-d", base.POSTGRES_DB, "-tA", "-c", "show server_version;"]);
  await teardownOwnedProjects();
  summary = {
    status: "LOCALLY_VERIFIED",
    candidate,
    image: { reference: image, localImageId: imageId, platform: imageInfo.stdout.trim(), registryDigest: null },
    prerequisites: ["RC-01 update import row isolation", "RC-02 bot fairness", "RC-03 hierarchy lock ordering", "RC-04 authoritative analytics observations", "RC-05 bounded batch hydration"],
    compose: { project, database: "disposable project-scoped PostgreSQL 16 volume", web: "production image, no source mounts", worker: "one watch process, file-based role health", migrations: "candidate image, forced fresh one-shot, failed attempt blocks Web/worker", webReadiness: "200", liveness: "200" },
    http: { fictionalFixtures: fixtures.length, duplicateWarningReviewed: true, importCommitted: true, selectedExport: "passed", publishedSearch: "passed", repeatedLinks: "passed", unpublishBoundary: "passed", optionalAnalytics: analyticsReport.collection.status, webhookWrongSecret: "401", webhookMockDelivery: botDelivery },
    bootstrap: { first: "created", second: "refused without changes" },
    cleanup: { first: firstCleanupResult, retry: cleanupResult, retainedState, doctor: doctorReport.cleanup },
    negative: { missingConfig: "rejected", incompleteSchema: "readiness 503 while liveness 200", migrationFailure: "rejected; Web/worker containers remained stopped" },
    postgresServerVersion: pgInfo.stdout.trim(),
    migrationAcceptance: migrationReport,
    databaseRecovery: runtimeReport.backup,
    predecessorCompatibility: runtimeReport.predecessorCompatibility,
    databaseInterruptionAndWorkerRecovery: runtimeReport.runtime,
    external: { stagingApplied: false, liveTelegramVerified: false, realContentApproved: false, independentBackupStorage: "not verified" },
    startedAt,
    completedAt: new Date().toISOString(),
    commands: stages,
  };
  const manifestPath = join(artifactDir, "candidate-manifest.json");
  const candidateManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  candidateManifest.status = summary.status;
  candidateManifest.completedAt = summary.completedAt;
  candidateManifest.acceptance = "ops:rehearsal";
  candidateManifest.summary = {
    health: summary.compose,
    negative: summary.negative,
    telegram: "mock",
    migrationAcceptance: migrationReport,
    databaseRecovery: runtimeReport.backup,
    predecessorCompatibility: runtimeReport.predecessorCompatibility,
  };
  candidateManifest.stages = stages;
  await writeFile(manifestPath, `${JSON.stringify(candidateManifest, null, 2)}\n`, { mode: 0o600 });
  await writeFile(join(artifactDir, "deployment-rehearsal.json"), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  failureReport = { status: "BLOCKED_OR_FAILED", candidate, image, localResources: { composeProject: project, additionalProjects: [migrationFailureProject, schemaFailureProject] }, evidenceDirectory: artifactDir, error: sanitize(error instanceof Error ? error.message : error), completedAt: new Date().toISOString(), commands: stages };
  await writeFile(join(artifactDir, "deployment-rehearsal-failure.json"), `${JSON.stringify(failureReport, null, 2)}\n`, { mode: 0o600 });
  console.error(JSON.stringify(failureReport, null, 2));
  process.exitCode = 1;
} finally {
  if (!teardownComplete) {
    for (const [name, envFile, profile] of [[schemaFailureProject, schemaFailEnv, "negative"], [migrationFailureProject, migrationFailEnv, "rehearsal"], [project, mainEnv, "rehearsal"]]) {
      try { await command("docker", [...composeBase(name, envFile, profile), "down", "--volumes", "--remove-orphans"], { allowFailure: true, timeout: 60_000, label: `teardown owned project ${name}` }); }
      catch { /* Teardown remains limited to these generated project names. */ }
    }
    teardownComplete = true;
  }
  await rm(privateDir, { recursive: true, force: true });
  if (!composeProjectCreated) await rm(bootstrapEnv, { force: true });
  if (failureReport) {
    failureReport.commands = stages;
    failureReport.teardown = stages.filter((stage) => stage.label.startsWith("teardown owned project")).map((stage) => ({ label: stage.label, exitCode: stage.exitCode }));
    await writeFile(join(artifactDir, "deployment-rehearsal-failure.json"), `${JSON.stringify(failureReport, null, 2)}\n`, { mode: 0o600 });
  }
}

async function waitForBotCompletion(projectName, envFile, id) {
  const end = Date.now() + 20_000;
  while (Date.now() < end) {
    const status = await command("docker", [...composeBase(projectName, envFile), "exec", "-T", "db", "psql", "-X", "-q", "-U", "hker_rehearsal", "-d", "hker_directory_test", "-tA", "-c", `select coalesce((select status from directory_bot_updates where id=${id}), 'missing');`], { allowFailure: true, label: "poll synthetic Bot delivery" });
    const value = status.stdout.trim().split("\n").at(-1);
    if (value === "complete") return { status: value, mockOnly: true, outboundNetwork: false };
    if (value === "failed") throw new Error("Mock Bot webhook job reached failed terminal state");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Synthetic webhook job did not complete through mock delivery");
}
