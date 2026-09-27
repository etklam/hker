import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

if (process.env.ALLOW_DIRECTORY_TEST_RESET !== "1")
  throw new Error(
    "Set ALLOW_DIRECTORY_TEST_RESET=1 for the isolated rehearsal",
  );
if (process.argv.some((arg) => arg.startsWith("--database-url")))
  throw new Error(
    "This script creates isolated databases and does not accept DATABASE_URL",
  );

const image =
  process.argv.find((arg) => arg.startsWith("--image="))?.slice(8) ??
  "hker:rc-local";
const predecessorImage = process.argv.find((arg) => arg.startsWith("--predecessor-image="))?.slice("--predecessor-image=".length) ?? null;
const evidenceDirectory = process.argv.find((arg) => arg.startsWith("--evidence-dir="))?.slice("--evidence-dir=".length) ?? "artifacts/release-candidate";
const postgresImage = "postgres:16-alpine";
const suffix = `${Date.now()}-${process.pid}-${randomBytes(3).toString("hex")}`;
const prefix = `hker-rc-${suffix}`;
const names = {
  network: `${prefix}-net`,
  sourceDb: `${prefix}-source-db`,
  restoreDb: `${prefix}-restore-db`,
  sourceWeb: `${prefix}-source-web`,
  restoreWeb: `${prefix}-restore-web`,
  predecessorWeb: `${prefix}-predecessor-web`,
  worker: `${prefix}-worker`,
};
const sourceDatabase = "hker_rc_source";
const restoreDatabase = "hker_rc_restore";
const workerOperationCount = 1_500;
const databasePassword = randomBytes(24).toString("base64url");
const sessionSecret = randomBytes(48).toString("base64url");
const adminEmail = "rc-runtime-admin@example.test";
const adminPassword = `RC-${randomBytes(18).toString("base64url")}!`;
const createdContainers = [];
let networkCreated = false;
let backupDirectory;
let disposableIndex = 0;

function trackDisposable(label) {
  const safeLabel = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const name = `${prefix}-${safeLabel}-${++disposableIndex}`;
  createdContainers.push(name);
  return name;
}

const startedAt = performance.now();
const timings = {};
const timed = async (name, work) => {
  const start = performance.now();
  const value = await work();
  timings[name] = Math.round(performance.now() - start);
  return value;
};

const sanitize = (value) =>
  String(value)
    .replaceAll(databasePassword, "[redacted]")
    .replaceAll(sessionSecret, "[redacted]")
    .replaceAll(adminPassword, "[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgres://[redacted]")
    .slice(-4000);

function docker(args, options = {}) {
  const {
    input,
    timeout = 30_000,
    allowFailure = false,
    label = "docker",
  } = options;
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeout);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const result = { code: code ?? -1, signal, stdout, stderr };
      if ((code ?? -1) === 0 || allowFailure) resolve(result);
      else
        reject(
          new Error(
            `${label} failed (${code ?? signal ?? "unknown"}): ${sanitize(stderr || stdout)}`,
          ),
        );
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function waitFor(check, label, timeout = 30_000, interval = 100) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(
    `${label} did not become ready${lastError ? `: ${sanitize(lastError)}` : ""}`,
  );
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

const databaseUrl = (container, database) =>
  `postgres://postgres:${databasePassword}@${container}:5432/${database}`;

function runtimeArgs(container, database, baseUrl, extra = {}) {
  const env = {
    HKER_ENVIRONMENT: "local",
    DATABASE_URL: databaseUrl(container, database),
    AUTH_SESSION_SECRET: sessionSecret,
    AUTH_SESSION_COOKIE_NAME: "hker_rc_session",
    APP_BASE_URL: baseUrl,
    TRUST_PROXY_HEADERS: "false",
    TELEGRAM_DELIVERY_MODE: "mock",
    DIRECTORY_ANALYTICS_ENABLED: "false",
    BOT_RETRY_BASE_MS: "100",
    BOT_RETRY_MAX_MS: "1000",
    BOT_RETRY_JITTER_RATIO: "0",
    ...extra,
  };
  return Object.entries(env).flatMap(([key, value]) => [
    "-e",
    `${key}=${value}`,
  ]);
}

async function startDatabase(name, database) {
  await docker(
    [
      "run",
      "-d",
      "--name",
      name,
      "--network",
      names.network,
      "-e",
      "POSTGRES_USER=postgres",
      "-e",
      `POSTGRES_PASSWORD=${databasePassword}`,
      "-e",
      `POSTGRES_DB=${database}`,
      postgresImage,
    ],
    { label: `start ${name}` },
  );
  createdContainers.push(name);
  let consecutiveReadyChecks = 0;
  await waitFor(
    async () => {
      const result = await docker(
        [
          "exec",
          name,
          "psql",
          "-X",
          "-q",
          "-U",
          "postgres",
          "-d",
          database,
          "-c",
          "select 1",
        ],
        { allowFailure: true, label: `ready ${name}` },
      );
      consecutiveReadyChecks =
        result.code === 0 ? consecutiveReadyChecks + 1 : 0;
      return consecutiveReadyChecks >= 10;
    },
    `${name} PostgreSQL`,
    30_000,
    100,
  );
}

async function psql(container, database, statement) {
  const result = await docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
      "-tA",
      "-f",
      "-",
    ],
    { input: statement, label: `psql ${container}` },
  );
  return result.stdout.trim();
}

async function runImage(container, database, baseUrl, command, extra = {}, runtimeImage = image) {
  const runName = trackDisposable("app-job");
  return docker(
    [
      "run",
      "--rm",
      "--name",
      runName,
      "--network",
      names.network,
      ...runtimeArgs(container, database, baseUrl, extra),
      runtimeImage,
      ...command,
    ],
    { timeout: 60_000, label: command.join(" ") },
  );
}

async function startWebsite(name, container, database, port, runtimeImage = image) {
  const baseUrl = `http://127.0.0.1:${port}`;
  await docker(
    [
      "run",
      "-d",
      "--name",
      name,
      "--network",
      names.network,
      "-p",
      `127.0.0.1:${port}:3000`,
      ...runtimeArgs(container, database, baseUrl),
      runtimeImage,
    ],
    { label: `start ${name}` },
  );
  createdContainers.push(name);
  await waitHttp(`${baseUrl}/api/health`, 200, `${name} liveness`);
  await waitHttp(`${baseUrl}/api/ready`, 200, `${name} readiness`);
  return baseUrl;
}

async function request(url, options = {}, timeout = 12_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
}

async function waitHttp(url, status, label, timeout = 30_000) {
  return waitFor(
    async () => {
      const response = await request(url);
      return response.status === status ? response : false;
    },
    label,
    timeout,
    150,
  );
}

async function login(baseUrl) {
  const response = await request(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  if (!response.ok)
    throw new Error(`Admin login failed with HTTP ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Admin login did not set a session cookie");
  const session = await request(`${baseUrl}/api/auth/session`, {
    headers: { cookie },
  });
  const body = await session.json();
  if (!session.ok || !body.authenticated || body.user?.role !== "admin")
    throw new Error("Admin session did not authenticate as admin");
  return cookie;
}

async function adminCreate(baseUrl, cookie, kind, data) {
  const response = await request(`${baseUrl}/api/admin/catalog`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      cookie,
    },
    body: JSON.stringify({ kind, data }),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(`Admin ${kind} create failed with HTTP ${response.status}`);
  return body;
}

async function verifyPublic(baseUrl) {
  const response = await request(`${baseUrl}/api/catalog?pageSize=100`);
  const body = await response.json();
  if (!response.ok) throw new Error("Public catalog request failed");
  const slugs = body.items.map((item) => item.slug);
  if (
    !slugs.includes("rc-runtime-public") ||
    slugs.includes("rc-runtime-draft")
  )
    throw new Error(
      "Public visibility did not preserve enabled/draft semantics",
    );
  const publicListing = body.items.find(
    (item) => item.slug === "rc-runtime-public",
  );
  if (publicListing.links?.length !== 2)
    throw new Error("Repeated same-type links were not publicly restored");
}

async function seedThroughRuntime(baseUrl, cookie, dbContainer, database) {
  const category = await adminCreate(baseUrl, cookie, "categories", {
    name: "RC 合成分類",
    slug: "rc-runtime-category",
  });
  const area = await adminCreate(baseUrl, cookie, "areas", {
    name: "RC 合成地區",
    slug: "rc-runtime-area",
  });
  const tag = await adminCreate(baseUrl, cookie, "tags", {
    name: "RC 合成標籤",
    slug: "rc-runtime-tag",
  });
  await adminCreate(baseUrl, cookie, "listings", {
    name: "RC 公開測試收錄",
    slug: "rc-runtime-public",
    categoryId: category.id,
    areaId: area.id,
    tagIds: [tag.id],
    revision: 7,
    enabled: true,
    links: [
      {
        type: "website",
        label: "主要網站",
        url: "https://rc-one.example.test/path",
      },
      {
        type: "website",
        label: "第二網站",
        url: "https://rc-two.example.test/path",
      },
    ],
  });
  await adminCreate(baseUrl, cookie, "listings", {
    name: "RC 草稿測試收錄",
    slug: "rc-runtime-draft",
    enabled: false,
  });
  const operations = Array.from({ length: workerOperationCount }, (_, index) => ({
    method: "sendMessage",
    body: { chat_id: -100900001, text: `RC mock ${index + 1}` },
  }));
  await psql(
    dbContainer,
    database,
    `
      insert into directory_content_plans
        (id, actor_id, kind, digest, payload, expires_at)
      select '00000000-0000-4000-8000-000000000909', id, 'bulk',
             'rc-runtime-digest', '{"targets":["rc-runtime-public"]}'::jsonb,
             now() + interval '1 day'
      from users where email = '${adminEmail}';
      insert into directory_bot_sessions (key, state)
      values ('-100900001:900001', '{"nonce":"rc-runtime","search":{}}'::jsonb);
      insert into directory_bot_updates
        (id, conversation_key, chat_key, status, operations, next_attempt_at)
      values
        (900001, '-100900001:900001', '-100900001', 'pending',
         $operations$${JSON.stringify(operations)}$operations$::jsonb,
         now() + interval '1 day');
    `,
  );
}

const snapshotSql = `
  select jsonb_build_object(
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_array(hash, created_at::text) order by created_at)
      from drizzle.__drizzle_migrations
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'slug', slug, 'revision', revision, 'enabled', enabled,
        'categoryId', category_id, 'areaId', area_id, 'aliases', aliases
      ) order by id)
      from directory_listings where slug like 'rc-runtime-%'
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_array(l.id, l.listing_id, l.type, l.label, l.url, l.enabled) order by l.id)
      from directory_listing_links l join directory_listings d on d.id = l.listing_id
      where d.slug like 'rc-runtime-%'
    ), '[]'::jsonb),
    'taxonomy', jsonb_build_object(
      'categories', coalesce((select jsonb_agg(jsonb_build_array(id, slug, enabled) order by id) from directory_categories where slug like 'rc-runtime-%'), '[]'::jsonb),
      'areas', coalesce((select jsonb_agg(jsonb_build_array(id, slug, parent_id, enabled) order by id) from directory_areas where slug like 'rc-runtime-%'), '[]'::jsonb),
      'tags', coalesce((select jsonb_agg(jsonb_build_array(id, slug, group_id, enabled) order by id) from directory_tags where slug like 'rc-runtime-%'), '[]'::jsonb),
      'relations', coalesce((select jsonb_agg(jsonb_build_array(lt.listing_id, lt.tag_id) order by lt.listing_id, lt.tag_id) from directory_listing_tags lt join directory_listings d on d.id = lt.listing_id where d.slug like 'rc-runtime-%'), '[]'::jsonb)
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_array(id, actor_id, kind, digest, payload, result is null) order by id)
      from directory_content_plans where digest = 'rc-runtime-digest'
    ), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_array(id, conversation_key, chat_key, status, next_operation, jsonb_array_length(operations)) order by id)
      from directory_bot_updates where id = 900001
    ), '[]'::jsonb),
    'admin', (select jsonb_build_object(
      'id', u.id, 'email', u.email, 'role', u.role,
      'identities', (select count(*)::int from auth_identities i where i.user_id = u.id)
    ) from users u where u.email = '${adminEmail}')
  );
`;

async function integritySnapshot(container, database) {
  return JSON.parse(await psql(container, database, snapshotSql));
}

async function runWorkerRehearsal(baseUrl) {
  await psql(
    names.restoreDb,
    restoreDatabase,
    `update directory_bot_updates set next_attempt_at=now() where id=900001 and status='pending' and next_operation=0;`,
  );
  const scheduledJob = JSON.parse(
    await psql(
      names.restoreDb,
      restoreDatabase,
      `select jsonb_build_object('status', status, 'next', next_operation, 'attempts', attempts) from directory_bot_updates where id=900001;`,
    ),
  );
  if (
    scheduledJob.status !== "pending" ||
    scheduledJob.next !== 0 ||
    scheduledJob.attempts !== 0
  )
    throw new Error("Predecessor compatibility test consumed the scheduled recovery job");
  await docker(
    [
      "run",
      "-d",
      "--name",
      names.worker,
      "--network",
      names.network,
      "--cpus=0.2",
      ...runtimeArgs(names.restoreDb, restoreDatabase, baseUrl, {
        TELEGRAM_MOCK_DELAY_MS: "5000",
      }),
      image,
      "node",
      "ops/bot-runner.cjs",
      "--watch",
      "--limit",
      "1",
      "--interval-ms",
      "100",
    ],
    { label: "start restored worker" },
  );
  createdContainers.push(names.worker);
  let interruptedAt;
  try {
    interruptedAt = await waitFor(
      async () => {
        const value = await psql(
          names.restoreDb,
          restoreDatabase,
          `select jsonb_build_object('status', status, 'next', next_operation, 'leased', lease_owner is not null) from directory_bot_updates where id=900001;`,
        );
        const state = JSON.parse(value);
        return state.status === "delivering" && state.leased ? state.next : false;
      },
      "worker claim",
      20_000,
      20,
    );
  } catch (error) {
    const [stateText, workerLogs, workerState] = await Promise.all([
      psql(names.restoreDb, restoreDatabase, `select jsonb_build_object('status', status, 'next', next_operation, 'attempts', attempts, 'errorClass', error_class)::text from directory_bot_updates where id=900001;`),
      docker(["logs", names.worker], { allowFailure: true, label: "capture interrupted worker logs" }),
      docker(["inspect", "--format", "{{.State.Status}}|{{.State.ExitCode}}", names.worker], { allowFailure: true, label: "capture interrupted worker state" }),
    ]);
    throw new Error(`${sanitize(error instanceof Error ? error.message : error)}; observedJob=${sanitize(stateText)}; worker=${sanitize(workerState.stdout.trim())}; workerLogs=${sanitize(workerLogs.stdout || workerLogs.stderr)}`);
  }
  await docker(["stop", "-t", "10", names.worker], {
    timeout: 15_000,
    label: "graceful worker stop",
  });
  const [inspection, logs] = await Promise.all([
    docker(["inspect", "--format", "{{.State.ExitCode}}", names.worker], {
      label: "worker exit status",
    }),
    docker(["logs", names.worker], { label: "worker logs" }),
  ]);
  if (
    Number(inspection.stdout.trim()) !== 0 ||
    !logs.stdout.includes('"stopped":true')
  )
    throw new Error("Worker did not report a graceful zero-exit shutdown");
  const afterStop = JSON.parse(
    await psql(
      names.restoreDb,
      restoreDatabase,
      `select jsonb_build_object('status', status, 'next', next_operation, 'leased', lease_owner is not null) from directory_bot_updates where id=900001;`,
    ),
  );
  if (
    afterStop.status !== "retry" ||
    afterStop.leased ||
    afterStop.next < interruptedAt ||
    afterStop.next >= workerOperationCount
  )
    throw new Error("Interrupted Bot job was not left in a recoverable state");
  await new Promise((resolve) => setTimeout(resolve, 250));
  const resumed = await runImage(names.restoreDb, restoreDatabase, baseUrl, [
    "node",
    "ops/bot-runner.cjs",
    "--limit",
    "10",
  ]);
  const resumeResult = JSON.parse(resumed.stdout.trim());
  const finalState = JSON.parse(
    await psql(
      names.restoreDb,
      restoreDatabase,
      `select jsonb_build_object('status', status, 'next', next_operation, 'leased', lease_owner is not null) from directory_bot_updates where id=900001;`,
    ),
  );
  if (
    finalState.status !== "complete" ||
    finalState.next !== workerOperationCount ||
    finalState.leased
  )
    throw new Error("Restored Bot job did not complete after restart");
  return { interruptedAt, afterStop, resumeResult, finalState };
}

async function cleanup() {
  for (const name of [...createdContainers].reverse()) {
    if (!name.startsWith("hker-rc-"))
      throw new Error(`Refusing to remove unexpected container ${name}`);
    await docker(["rm", "-f", name], {
      allowFailure: true,
      timeout: 15_000,
      label: `remove ${name}`,
    });
  }
  if (networkCreated) {
    if (!names.network.startsWith("hker-rc-"))
      throw new Error("Refusing to remove unexpected network");
    await docker(["network", "rm", names.network], {
      allowFailure: true,
      label: `remove ${names.network}`,
    });
  }
  if (backupDirectory)
    await rm(backupDirectory, { recursive: true, force: true });
}

let summary;
try {
  const imageId = (
    await docker(["image", "inspect", image, "--format", "{{.Id}}"], {
      label: "inspect application image",
    })
  ).stdout.trim();
  const versionContainer = trackDisposable("version");
  const nodeVersion = (
    await docker(
      ["run", "--rm", "--name", versionContainer, image, "node", "--version"],
      { label: "application Node version" },
    )
  ).stdout.trim();
  await docker(["network", "create", names.network], {
    label: "create isolated network",
  });
  networkCreated = true;
  await startDatabase(names.sourceDb, sourceDatabase);
  const sourcePort = await reservePort();
  const sourceBaseUrl = `http://127.0.0.1:${sourcePort}`;
  const migration = await timed("sourceMigrationMs", async () => {
    await runImage(names.sourceDb, sourceDatabase, sourceBaseUrl, [
      "node",
      "ops/migrate.cjs",
      "--apply",
    ]);
    return runImage(names.sourceDb, sourceDatabase, sourceBaseUrl, [
      "node",
      "ops/migrate.cjs",
    ]);
  });
  await runImage(
    names.sourceDb,
    sourceDatabase,
    sourceBaseUrl,
    ["node", "ops/create-admin.cjs"],
    {
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_NAME: "RC Runtime Admin",
    },
  );
  await timed("sourceStartupMs", () =>
    startWebsite(names.sourceWeb, names.sourceDb, sourceDatabase, sourcePort),
  );
  const sourceCookie = await login(sourceBaseUrl);
  await seedThroughRuntime(
    sourceBaseUrl,
    sourceCookie,
    names.sourceDb,
    sourceDatabase,
  );
  await verifyPublic(sourceBaseUrl);

  await docker(["stop", "-t", "10", names.sourceDb], {
    timeout: 15_000,
    label: "stop source database",
  });
  await waitHttp(
    `${sourceBaseUrl}/api/health`,
    200,
    "website liveness while database is unavailable",
  );
  await waitHttp(
    `${sourceBaseUrl}/api/ready`,
    503,
    "website readiness while database is unavailable",
    35_000,
  );
  await docker(["start", names.sourceDb], { label: "restart source database" });
  await waitFor(
    async () =>
      (
        await docker(
          [
            "exec",
            names.sourceDb,
            "pg_isready",
            "-U",
            "postgres",
            "-d",
            sourceDatabase,
          ],
          { allowFailure: true, label: "source reconnect readiness" },
        )
      ).code === 0,
    "restarted source PostgreSQL",
  );
  await waitHttp(
    `${sourceBaseUrl}/api/ready`,
    200,
    "website database reconnect",
  );
  await docker(["restart", "-t", "10", names.sourceWeb], {
    timeout: 20_000,
    label: "restart source website",
  });
  await waitHttp(
    `${sourceBaseUrl}/api/ready`,
    200,
    "website container restart",
  );
  await login(sourceBaseUrl);
  await verifyPublic(sourceBaseUrl);

  const sourceSnapshot = await integritySnapshot(
    names.sourceDb,
    sourceDatabase,
  );
  backupDirectory = await mkdtemp(join(tmpdir(), "hker-rc-backup-"));
  const backupPath = join(backupDirectory, "hker-rc.dump");
  await timed("backupMs", async () => {
    await docker(
      [
        "exec",
        names.sourceDb,
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--file=/tmp/hker-rc.dump",
        "-U",
        "postgres",
        sourceDatabase,
      ],
      { timeout: 60_000, label: "pg_dump source" },
    );
    await docker(["cp", `${names.sourceDb}:/tmp/hker-rc.dump`, backupPath], {
      label: "copy private backup",
    });
    await chmod(backupPath, 0o600);
    const checksum = createHash("sha256").update(await readFile(backupPath)).digest("hex");
    const sizeBytes = (await readFile(backupPath)).byteLength;
    const inspectContainer = trackDisposable("backup-inspect");
    await docker(
      [
        "run",
        "--rm",
        "--name",
        inspectContainer,
        "-v",
        `${backupPath}:/backup.dump:ro`,
        postgresImage,
        "pg_restore",
        "--list",
        "/backup.dump",
      ],
      { label: "inspect custom backup" },
    );
    timings.backupEvidence = { checksumSha256: checksum, sizeBytes };
  });

  await startDatabase(names.restoreDb, restoreDatabase);
  await timed("restoreMs", async () => {
    await docker(["cp", backupPath, `${names.restoreDb}:/tmp/hker-rc.dump`], {
      label: "copy backup to restore database",
    });
    await docker(
      [
        "exec",
        names.restoreDb,
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "-U",
        "postgres",
        "-d",
        restoreDatabase,
        "/tmp/hker-rc.dump",
      ],
      { timeout: 60_000, label: "pg_restore isolated database" },
    );
  });
  await runImage(names.restoreDb, restoreDatabase, "http://127.0.0.1", [
    "node",
    "ops/migrate.cjs",
  ]);
  const restoreSnapshot = await integritySnapshot(
    names.restoreDb,
    restoreDatabase,
  );
  if (JSON.stringify(sourceSnapshot) !== JSON.stringify(restoreSnapshot))
    throw new Error("Restored integrity snapshot differs from the source");

  const restorePort = await reservePort();
  const restoreBaseUrl = await timed("restoreStartupMs", () =>
    startWebsite(
      names.restoreWeb,
      names.restoreDb,
      restoreDatabase,
      restorePort,
    ),
  );
  await login(restoreBaseUrl);
  await verifyPublic(restoreBaseUrl);

  let predecessorCompatibility = { status: "not tested" };
  let predecessorImageId = null;
  if (predecessorImage) {
    predecessorImageId = (await docker(["image", "inspect", predecessorImage, "--format", "{{.Id}}"], {
      label: "inspect committed predecessor image",
    })).stdout.trim();
    const predecessorPort = await reservePort();
    const predecessorBaseUrl = await startWebsite(
      names.predecessorWeb,
      names.restoreDb,
      restoreDatabase,
      predecessorPort,
      predecessorImage,
    );
    await login(predecessorBaseUrl);
    await verifyPublic(predecessorBaseUrl);
    await psql(names.restoreDb, restoreDatabase, `
      insert into directory_bot_sessions (key, state) values ('900002:900002', '{"nonce":"rollback-fixture"}'::jsonb);
      insert into directory_bot_updates (id, conversation_key, chat_key, status, operations)
      values (900002, '900002:900002', '900002', 'pending', '[{"method":"sendMessage","body":{"text":"Fictional predecessor compatibility"}}]'::jsonb);
    `);
    await runImage(names.restoreDb, restoreDatabase, predecessorBaseUrl, [
      "node", "ops/bot-runner.cjs", "--limit", "10",
    ], {}, predecessorImage);
    const predecessorJob = JSON.parse(await psql(names.restoreDb, restoreDatabase,
      "select jsonb_build_object('status', status, 'next', next_operation) from directory_bot_updates where id=900002;"));
    if (predecessorJob.status !== "complete" || predecessorJob.next !== 1)
      throw new Error("Committed predecessor worker did not process a synthetic job against the forward schema");
    await docker(["stop", "-t", "10", names.predecessorWeb], {
      timeout: 15_000,
      label: "stop predecessor compatibility Web",
    });
    predecessorCompatibility = {
      status: "passed",
      image: predecessorImage,
      localImageId: predecessorImageId,
      forwardSchemaMigrationCount: restoreSnapshot.ledger.length,
      webReadiness: "ready",
      publicVisibility: "preserved",
      mockWorkerDelivery: predecessorJob.status,
    };
  }
  const worker = await timed("workerRecoveryMs", () =>
    runWorkerRehearsal(restoreBaseUrl),
  );
  const status = JSON.parse(
    (
      await runImage(names.restoreDb, restoreDatabase, restoreBaseUrl, [
        "node",
        "ops/bot-runner.cjs",
        "--status",
      ])
    ).stdout.trim(),
  );
  const postgresVersion = await psql(
    names.restoreDb,
    restoreDatabase,
    "show server_version;",
  );
  const pgDumpVersion = (await docker(["exec", names.sourceDb, "pg_dump", "--version"], {
    label: "record pg_dump version",
  })).stdout.trim();
  const pgRestoreVersion = (await docker(["exec", names.restoreDb, "pg_restore", "--version"], {
    label: "record pg_restore version",
  })).stdout.trim();
  const backupBytes = await readFile(join(backupDirectory, "hker-rc.dump"));
  summary = {
    status: "passed",
    image,
    imageId,
    nodeVersion,
    postgresVersion,
    backup: {
      format: "PostgreSQL custom archive",
      checksumSha256: createHash("sha256").update(backupBytes).digest("hex"),
      sizeBytes: backupBytes.byteLength,
      pgDumpVersion,
      pgRestoreVersion,
      serverVersion: postgresVersion,
      target: "separate disposable restore database",
      fixtureDbRemoved: true,
    },
    migrationPreflight: JSON.parse(migration.stdout.trim().split("\n")[0]),
    migrationCount: sourceSnapshot.ledger.length,
    restored: {
      listings: restoreSnapshot.listings.length,
      links: restoreSnapshot.links.length,
      plans: restoreSnapshot.plans.length,
      pendingJobsBeforeWorker: restoreSnapshot.jobs.length,
      adminRole: restoreSnapshot.admin.role,
    },
    runtime: {
      livenessDuringDatabaseOutage: "ok",
      readinessDuringDatabaseOutage: "503",
      readinessAfterReconnect: "ready",
      websiteRestart: "ready",
      restoredAdminLogin: "ok",
      restoredPublicVisibility: "ok",
      workerInterruptedAtOperation: worker.interruptedAt,
      workerStateAfterSignal: worker.afterStop.status,
      workerFinalState: worker.finalState.status,
      workerHeartbeat: Boolean(status.heartbeat),
    },
    predecessorCompatibility,
    timingsMs: {
      ...timings,
      total: Math.round(performance.now() - startedAt),
    },
    isolation: {
      network: "unique disposable bridge for host-driven HTTP checks",
      databases: [sourceDatabase, restoreDatabase],
      telegram: { mode: "mock", tokenProvided: false },
      backupRemovedOnExit: true,
    },
  };
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    join(evidenceDirectory, "runtime-rehearsal.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(sanitize(error instanceof Error ? error.message : error));
  process.exitCode = 1;
} finally {
  await cleanup();
}
