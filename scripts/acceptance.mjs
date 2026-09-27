import { spawnSync } from "node:child_process";
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
  TELEGRAM_DELIVERY_MODE: "mock",
  AUTH_SESSION_SECRET:
    process.env.AUTH_SESSION_SECRET ??
    "isolated-acceptance-session-secret-never-use-live",
  AUTH_SESSION_COOKIE_NAME: "hker_test_session",
  E2E_BASE_URL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
};
env.APP_BASE_URL = env.E2E_BASE_URL;
for (const args of [
  ["run", "typecheck"],
  ["run", "lint"],
  ["test", "--", "--maxWorkers=4"],
  ["run", "test:migrations"],
  ["run", "db:migrate:safe"],
  ["run", "test:integration"],
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
  const result = spawnSync("npm", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
