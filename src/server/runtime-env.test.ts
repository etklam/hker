import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { validateRuntimeEnv } = require("../../scripts/runtime-env.cjs");
const local = {
  DATABASE_URL: "postgres://test:test@127.0.0.1/hker_directory_test",
  APP_BASE_URL: "http://localhost:3000",
  AUTH_SESSION_SECRET: "local-only-session-secret-with-over-32-characters",
  AUTH_SESSION_COOKIE_NAME: "hker_session",
  TELEGRAM_DELIVERY_MODE: "mock",
};

describe("deployment configuration contract", () => {
  it("accepts isolated local mock configuration", () => {
    expect(() => validateRuntimeEnv(local)).not.toThrow();
  });
  it("requires an explicit non-mock mode for production", () => {
    expect(() => validateRuntimeEnv({ ...local, NODE_ENV: "production", APP_BASE_URL: "https://directory.example.test", AUTH_SESSION_COOKIE_NAME: "__Host-hker_session", TRUST_PROXY_HEADERS: "false", TELEGRAM_DELIVERY_MODE: undefined })).toThrow(/explicitly set/);
    expect(() => validateRuntimeEnv({ ...local, NODE_ENV: "production", APP_BASE_URL: "https://directory.example.test", AUTH_SESSION_COOKIE_NAME: "__Host-hker_session", TRUST_PROXY_HEADERS: "false", TELEGRAM_DELIVERY_MODE: "mock" })).toThrow(/restricted/);
  });
  it("allows a worker without the web session secret but never permits an unknown mode", () => {
    const worker = { DATABASE_URL: local.DATABASE_URL, APP_BASE_URL: "http://localhost:3000", TELEGRAM_DELIVERY_MODE: "disabled" };
    expect(() => validateRuntimeEnv(worker, { role: "worker" })).not.toThrow();
    expect(() => validateRuntimeEnv({ ...worker, TELEGRAM_DELIVERY_MODE: "mokk" }, { role: "worker" })).toThrow(/must be explicitly set/);
  });
  it("requires webhook credentials only in the Web process for live delivery", () => {
    const staging = {
      HKER_ENVIRONMENT: "staging",
      DATABASE_URL: local.DATABASE_URL,
      APP_BASE_URL: "https://staging.example.test",
      AUTH_SESSION_SECRET: local.AUTH_SESSION_SECRET,
      AUTH_SESSION_COOKIE_NAME: "__Host-hker_session",
      TRUST_PROXY_HEADERS: "false",
      TELEGRAM_DELIVERY_MODE: "live",
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_TEST_CHAT_ID: "-100900001",
    };
    expect(() => validateRuntimeEnv(staging, { role: "worker" })).not.toThrow();
    expect(() => validateRuntimeEnv(staging)).toThrow(/webhook secret/);
    expect(() => validateRuntimeEnv({ ...staging, TELEGRAM_WEBHOOK_SECRET: "test-secret" })).not.toThrow();
  });
});
