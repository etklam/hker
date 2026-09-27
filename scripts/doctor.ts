import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const loadRuntimeEnv = createRequire(__filename);

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);
const ageSeconds = (value: string | Date | null) => value
  ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  : null;

async function main() {
  const mode = process.env.TELEGRAM_DELIVERY_MODE ?? (process.env.NODE_ENV === "production" ? "unset" : "mock");
  const deployment = process.env.HKER_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "local");
  let configuration = { valid: false, error: "runtime validator unavailable" };
  try {
    loadRuntimeEnv("./runtime-env.cjs").validateRuntimeEnv(process.env);
    configuration = { valid: true, error: "" };
  } catch (error) {
    configuration = {
      valid: false,
      error: error instanceof Error ? error.message : "invalid runtime configuration",
    };
  }

  const report: Record<string, unknown> = {
    status: "unavailable",
    environment: deployment,
    candidate: process.env.HKER_CANDIDATE_ID ?? "unknown",
    image: process.env.HKER_IMAGE_REF ?? "unknown",
    configuration,
    telegram: { mode, tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), networkInspection: "not requested" },
    database: { configured: Boolean(process.env.DATABASE_URL), reachable: false, identity: null },
    schema: { compatible: false, component: "release", missing: [] },
    migrationPreflight: { status: "not run" },
    worker: { enabled: mode !== "disabled", mode, runners: [] },
    cleanup: { status: "unknown", lastSuccessAgeSeconds: null, deleted: null, recentFailure: null },
  };

  if (!process.env.DATABASE_URL) {
    report.status = "configuration_missing";
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    const url = new URL(process.env.DATABASE_URL);
    report.database = {
      configured: true,
      reachable: false,
      identity: hash(`${url.hostname}:${url.port || "5432"}${url.pathname}:${url.username}`),
    };
    const [{ db, closeDatabase }, schemaModule, deliveryModule] = await Promise.all([
      import("../src/server/db"),
      import("../src/server/catalog/schema-contract"),
      import("../src/server/catalog/bot-delivery"),
    ]);
    try {
      await db.execute((await import("drizzle-orm")).sql`select 1`);
      report.database = { ...(report.database as object), reachable: true };
      const schema = await schemaModule.inspectDirectorySchema("release");
      report.schema = schema;
      const migrationEnvironment = { ...process.env };
      for (const key of Object.keys(migrationEnvironment))
        if (/^(TELEGRAM_|AUTH_|ADMIN_)/.test(key)) delete migrationEnvironment[key];
      const migration = spawnSync(process.execPath, [join(__dirname, "migrate.cjs")], {
        env: migrationEnvironment,
        encoding: "utf8",
        timeout: 30_000,
      });
      let preflight: Record<string, unknown> = { status: migration.status === 0 ? "compatible" : "incompatible" };
      if (migration.status === 0) {
        try {
          const parsed = JSON.parse(migration.stdout.split("\n")[0]);
          preflight = { status: parsed.status, applied: parsed.applied, pending: parsed.pending };
        } catch { /* Keep the sanitized status when output is not machine-readable. */ }
      }
      report.migrationPreflight = preflight;
      if (schema.compatible) {
        const status = await deliveryModule.getBotDeliveryStatus();
        const runners = status.runners as unknown as Array<{
          runnerId: string;
          heartbeatAt: string | Date;
          progressAt?: string | Date | null;
        }>;
        report.worker = {
          enabled: mode !== "disabled",
          mode,
          queue: status.counts,
          oldestPendingSeconds: status.oldestPendingSeconds,
          runners: runners.map((runner) => ({
            identity: hash(runner.runnerId),
            heartbeatAgeSeconds: ageSeconds(runner.heartbeatAt),
            progressAgeSeconds: ageSeconds(runner.progressAt ?? null),
          })),
        };
        const cleanup = await db.execute((await import("drizzle-orm")).sql`
          select status, started_at as "startedAt", finished_at as "finishedAt", counts,
                 error_class as "errorClass"
          from directory_maintenance_runs where kind = 'retention'
          order by started_at desc limit 1
        `);
        const last = cleanup[0] as { status: string; startedAt: string | Date; finishedAt: string | Date | null; counts: Record<string, number | null>; errorClass: string | null } | undefined;
        report.cleanup = last
          ? {
              status: last.status,
              lastRunAgeSeconds: ageSeconds(last.finishedAt ?? last.startedAt),
              deleted: last.counts,
              recentFailure: last.status === "failed" ? last.errorClass : null,
            }
          : { status: "not observed", lastRunAgeSeconds: null, deleted: null, recentFailure: null };
      } else {
        report.cleanup = { status: "unavailable: release schema incompatible", lastRunAgeSeconds: null, deleted: null, recentFailure: null };
      }
      report.status = configuration.valid && schema.compatible && migration.status === 0 ? "ready" : "degraded";
      if (migration.status !== 0) report.migrationPreflight = { status: "incompatible" };
    } finally {
      await closeDatabase();
    }
  } catch {
    report.database = { ...(report.database as object), reachable: false };
    report.status = "database_unavailable";
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "ready") process.exitCode = 1;
}

main().catch(() => {
  console.error(JSON.stringify({ status: "failed", error: "doctor_failed" }));
  process.exitCode = 1;
});
