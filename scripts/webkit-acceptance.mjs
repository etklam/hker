import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { webkit } from "@playwright/test";

const evidence = resolve("artifacts/release-candidate");
const report = resolve(evidence, "webkit.json");
mkdirSync(evidence, { recursive: true });

function blocked(reason) {
  writeFileSync(
    report,
    JSON.stringify(
      { status: "blocked", reason, recordedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.error(`WebKit acceptance BLOCKED: ${reason}`);
  process.exit(2);
}

if (Number(process.versions.node.split(".")[0]) !== 24)
  blocked("Node 24 is required");

let database;
try {
  database = new URL(process.env.DATABASE_URL ?? "http://invalid");
} catch {
  blocked("DATABASE_URL is invalid");
}
if (
  database.pathname !== "/hker_directory_test" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  process.env.ALLOW_DIRECTORY_TEST_RESET !== "1"
)
  blocked(
    "a disposable loopback hker_directory_test and ALLOW_DIRECTORY_TEST_RESET=1 are required",
  );

const state = resolve(
  process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json",
);
if (!existsSync(state))
  blocked("the required isolated E2E fixture state is missing");

const executable = webkit.executablePath();
if (!existsSync(executable))
  blocked(
    `Playwright WebKit is not installed for this package (${executable})`,
  );

const browsers = JSON.parse(
  readFileSync("node_modules/playwright-core/browsers.json", "utf8"),
).browsers;
const expected = browsers.find((browser) => browser.name === "webkit");
const revisions = new Set([
  expected?.revision,
  ...Object.values(expected?.revisionOverrides ?? {}),
]);
if (
  ![...revisions].some((revision) => executable.includes(`webkit-${revision}`))
)
  blocked("the installed WebKit revision does not match playwright-core");
console.log(
  `WebKit ${expected?.browserVersion ?? "unknown"} revision ${[...revisions].join("/")} resolved at ${executable}`,
);

const env = {
  ...process.env,
  APP_BASE_URL:
    process.env.E2E_BASE_URL ??
    process.env.APP_BASE_URL ??
    "http://127.0.0.1:3100",
  AUTH_SESSION_COOKIE_NAME: "hker_test_session",
  AUTH_SESSION_SECRET:
    process.env.AUTH_SESSION_SECRET ??
    "isolated-acceptance-session-secret-never-use-live",
  DIRECTORY_ACCEPTANCE: "1",
  DIRECTORY_E2E_FIXTURE: "1",
  E2E_BASE_URL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
  PLAYWRIGHT_JSON_OUTPUT_NAME: report,
  TELEGRAM_DELIVERY_MODE: "mock",
};

const playwright = resolve("node_modules/.bin/playwright");
const result = spawnSync(
  playwright,
  [
    "test",
    "e2e/rc-workflows.spec.ts",
    "e2e/admin-directory.spec.ts",
    "--project=webkit",
    "--workers=1",
    "--reporter=list,json",
    "--grep",
    "RC update import|portable search round-trip|retains stale draft|OR navigation remains editable",
  ],
  { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) blocked(result.error.message);
process.exit(result.status ?? 1);
