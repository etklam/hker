function validateRuntimeEnv(env = process.env) {
  for (const key of ["DATABASE_URL", "AUTH_SESSION_SECRET", "APP_BASE_URL"]) {
    if (!env[key]) throw new Error(`Missing required configuration: ${key}`);
  }
  if (
    env.AUTH_SESSION_SECRET.length < 32 ||
    /^(dev-secret|change-me)/i.test(env.AUTH_SESSION_SECRET)
  )
    throw new Error(
      "AUTH_SESSION_SECRET must be a strong secret of at least 32 characters",
    );
  if (!/^postgres(ql)?:$/.test(new URL(env.DATABASE_URL).protocol))
    throw new Error("Invalid DATABASE_URL protocol");
  const base = new URL(env.APP_BASE_URL);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("APP_BASE_URL must be an HTTP(S) origin");
  const ttl = Number(env.AUTH_SESSION_TTL_DAYS ?? 30);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 365)
    throw new Error("AUTH_SESSION_TTL_DAYS must be 1–365");
  const cookie = env.AUTH_SESSION_COOKIE_NAME ?? "__Host-hker_session";
  if (!/^[A-Za-z0-9_-]+$/.test(cookie))
    throw new Error("Invalid session cookie name");
  if (cookie.startsWith("__Host-") && base.protocol !== "https:")
    throw new Error(
      "Host-prefixed session cookies require HTTPS; set a plain cookie name for local HTTP",
    );
  if (
    env.TELEGRAM_DELIVERY_MODE === "live" &&
    (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET)
  )
    throw new Error("Live Telegram delivery needs token and webhook secret");
  if (
    env.TRUST_PROXY_HEADERS &&
    !["true", "false"].includes(env.TRUST_PROXY_HEADERS)
  )
    throw new Error("Invalid TRUST_PROXY_HEADERS");
}
module.exports = { validateRuntimeEnv };
if (require.main === module) {
  try {
    validateRuntimeEnv();
    console.log("Runtime configuration valid");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
