import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/render-k3s.mjs");
const baseEnvironment = {
  PATH: process.env.PATH ?? "",
  HKER_ENVIRONMENT: "staging",
  TELEGRAM_DELIVERY_MODE: "disabled",
};

describe("K3s offline release renderer", () => {
  it("renders a Web-only, secret-referenced bundle without selecting or contacting a cluster", () => {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: baseEnvironment,
    });
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({
      status: "rendered_and_offline_validated",
      exampleOnly: true,
      mutationRequested: false,
      checks: { networkOrClusterContacted: false, serverAdmission: "not run" },
      target: { context: "unselected", botMode: "disabled" },
    });
    const migration = readFileSync(report.manifests.migration, "utf8");
    const preflight = readFileSync(report.manifests.preflight, "utf8");
    const runtime = readFileSync(report.manifests.runtime, "utf8");
    const preflightJob = JSON.parse(preflight.split(/^---\s*$/m).at(-1)!);
    const migrationJob = JSON.parse(migration.trim());
    const documents = runtime.split(/^---\s*$/m).map((value) => JSON.parse(value));
    expect(migration).not.toContain("postgresql://");
    expect(preflight).not.toContain("postgresql://");
    expect(runtime).not.toContain("postgresql://");
    expect(preflightJob.spec.template.spec.containers[0].command).toEqual(["node", "ops/migrate.cjs"]);
    expect(migrationJob.spec.template.spec.containers[0].command).toEqual(["node", "ops/migrate.cjs", "--apply"]);
    expect(documents.find((value) => value.kind === "Deployment" && value.metadata.name === "web").spec.replicas).toBe(1);
    expect(documents.find((value) => value.kind === "Deployment" && value.metadata.name === "worker").spec.replicas).toBe(0);
    expect(documents.find((value) => value.kind === "CronJob").spec.concurrencyPolicy).toBe("Forbid");
    expect(documents.find((value) => value.kind === "CronJob").spec.timeZone).toBe("Asia/Hong_Kong");
  });

  it("refuses --apply before reading cluster state unless exact operator acknowledgements are supplied", () => {
    const result = spawnSync(process.execPath, [script, "--apply"], {
      encoding: "utf8",
      env: {
        ...baseEnvironment,
        HKER_NAMESPACE: "hker-staging-fixture",
        HKER_IMAGE: `registry.example.test/hker@sha256:${"a".repeat(64)}`,
        APP_BASE_URL: "https://staging.example.test",
        HKER_RUNTIME_SECRET: "hker-staging-runtime",
        HKER_KUBE_CONTEXT: "fixture-context",
        HKER_CANDIDATE_ID: "phase10-fixture",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--apply refused");
    expect(result.stderr).toContain("verifiedBackup");
    expect(JSON.parse(result.stdout).checks).toMatchObject({
      networkOrClusterContacted: false,
      serverAdmission: "not run",
    });
  });
});
