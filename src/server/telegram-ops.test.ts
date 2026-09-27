import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = `${process.cwd()}/scripts/telegram-ops.mjs`;
const safeEnvironment = {
  PATH: process.env.PATH ?? "",
  HKER_ENVIRONMENT: "staging",
  TELEGRAM_DELIVERY_MODE: "live",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_WEBHOOK_SECRET: "",
  TELEGRAM_WEBHOOK_URL: "https://staging.example.test/api/telegram/webhook",
};

describe("Telegram operations helper", () => {
  it("inspects configuration without contacting Telegram by default", () => {
    const result = spawnSync(process.execPath, [script, "inspect"], {
      encoding: "utf8",
      env: safeEnvironment,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "dry_run",
      networkContacted: false,
      tokenConfigured: false,
    });
  });

  it("refuses a webhook change before network access without a protected token", () => {
    const result = spawnSync(process.execPath, [script, "set-webhook", "--apply"], {
      encoding: "utf8",
      env: safeEnvironment,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("TELEGRAM_BOT_TOKEN is required");
    expect(result.stderr).not.toContain("https://staging.example.test");
  });
});
