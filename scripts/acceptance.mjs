import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import os from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { chromium } from "@playwright/test";
const runId = `${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const evidence = join("artifacts/release-candidate/acceptance", runId);
mkdirSync(evidence, { recursive: true });
const git = (...args) =>
  spawnSync("git", args, { encoding: "utf8" }).stdout?.trim();
const sourceFiles = (
  git("ls-files", "--cached", "--others", "--exclude-standard") ?? ""
)
  .split("\n")
  .filter(Boolean)
  .sort();
const sourceHash = createHash("sha256");
for (const path of sourceFiles) {
  sourceHash.update(`${path}\0`);
  try {
    sourceHash.update(readFileSync(path));
  } catch {
    sourceHash.update("[deleted]");
  }
}
const manifest = {
  sha: git("rev-parse", "HEAD"),
  workingTreeStatus: git("status", "--short"),
  sourceTreeSha256: sourceHash.digest("hex"),
  workingTreeDiffSha256: createHash("sha256")
    .update(git("diff", "HEAD") ?? "")
    .digest("hex"),
  lockfileSha256: createHash("sha256")
    .update(readFileSync("package-lock.json"))
    .digest("hex"),
  node: process.version,
  platform: `${os.platform()} ${os.arch()}`,
  cpus: os.cpus().length,
  browserPackage: JSON.parse(
    readFileSync("node_modules/@playwright/test/package.json", "utf8"),
  ).version,
  fixture: "disposable loopback hker_directory_test; mock Telegram",
  evidenceDirectory: evidence,
  startedAt: new Date().toISOString(),
  stages: [],
};
const saveManifest = () =>
  writeFileSync(`${evidence}/manifest.json`, JSON.stringify(manifest, null, 2));
saveManifest();
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  url.pathname !== "/hker_directory_test" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  process.env.ALLOW_DIRECTORY_TEST_RESET !== "1"
)
  throw new Error(
    "Acceptance requires disposable loopback hker_directory_test and ALLOW_DIRECTORY_TEST_RESET=1",
  );
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Use Node 24 (.nvmrc)");
const env = {
  ...process.env,
  DIRECTORY_E2E_FIXTURE: "1",
  DIRECTORY_ACCEPTANCE: "1",
  HKER_ACCEPTANCE_EVIDENCE_DIR: evidence,
  HKER_ENVIRONMENT: "test",
  TELEGRAM_DELIVERY_MODE: "mock",
  AUTH_SESSION_SECRET:
    process.env.AUTH_SESSION_SECRET ??
    "isolated-acceptance-session-secret-never-use-live",
  AUTH_SESSION_COOKIE_NAME: "hker_test_session",
  E2E_BASE_URL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
};
env.APP_BASE_URL = env.E2E_BASE_URL;
const probe = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  manifest.postgres = (await probe`show server_version`)[0].server_version;
} finally {
  await probe.end();
}
manifest.chromium =
  spawnSync(chromium.executablePath(), ["--version"], {
    encoding: "utf8",
  }).stdout?.trim() || "unavailable";
env.PLAYWRIGHT_JSON_OUTPUT_NAME = join(evidence, "chromium.json");
const sanitize = (text) =>
  text
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]")
    .replaceAll(env.AUTH_SESSION_SECRET, "[REDACTED_SESSION_SECRET]");
for (const args of [
  ["run", "typecheck"],
  ["run", "lint"],
  [
    "test",
    "--",
    "--maxWorkers=4",
    "--reporter=default",
    "--reporter=json",
    `--outputFile=${join(evidence, "unit.json")}`,
  ],
  ["run", "test:migrations"],
  ["run", "db:migrate:safe"],
  [
    "run",
    "test:integration",
    "--",
    "--reporter=default",
    "--reporter=json",
    `--outputFile=${join(evidence, "integration.json")}`,
  ],
  ["run", "build"],
  ["run", "e2e:fixture"],
  [
    "run",
    "test:e2e",
    "--",
    "--project=chromium",
    "--workers=1",
    "--reporter=list,json",
  ],
]) {
  console.log(`\nAcceptance: npm ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync("npm", args, {
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = sanitize(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  process.stdout.write(output);
  const log = `${manifest.stages.length + 1}-${args[0] === "run" ? args[1] : args[0]}.log`;
  writeFileSync(`${evidence}/${log}`, output);
  manifest.stages.push({
    command: `npm ${args.join(" ")}`,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    log,
  });
  saveManifest();
  if (result.status !== 0) process.exit(result.status ?? 1);
}
manifest.completedAt = new Date().toISOString();
manifest.counts = {};
for (const kind of ["unit", "integration", "chromium"]) {
  const report = JSON.parse(readFileSync(`${evidence}/${kind}.json`, "utf8"));
  manifest.counts[kind] =
    kind === "chromium"
      ? report.stats
      : {
          passed: report.numPassedTests,
          failed: report.numFailedTests,
          skipped: report.numPendingTests,
          total: report.numTotalTests,
        };
}
saveManifest();
