function validateRuntimeEnv(env = process.env, { role = "web" } = {}) {
  if (!["web", "worker"].includes(role)) throw new Error("Invalid runtime role");
  const deployment = env.HKER_ENVIRONMENT ?? (env.NODE_ENV === "production" ? "production" : "local");
  if (!["local", "test", "staging", "production"].includes(deployment))
    throw new Error("HKER_ENVIRONMENT must be local, test, staging or production");
  const required = role === "web"
    ? ["DATABASE_URL", "AUTH_SESSION_SECRET", "APP_BASE_URL"]
    : ["DATABASE_URL", "APP_BASE_URL"];
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing required configuration: ${key}`);
  }
  if (role === "web" && (
    env.AUTH_SESSION_SECRET.length < 32 ||
    /^(dev-secret|change-me)/i.test(env.AUTH_SESSION_SECRET)
  ))
    throw new Error(
      "AUTH_SESSION_SECRET must be a strong secret of at least 32 characters",
    );
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { throw new Error("Invalid DATABASE_URL"); }
  if (!/^postgres(ql)?:$/.test(database.protocol) || !database.hostname || database.pathname === "/")
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
  const deliveryMode = env.TELEGRAM_DELIVERY_MODE ?? (["local", "test"].includes(deployment) ? "mock" : "");
  if (!["mock", "live", "disabled"].includes(deliveryMode))
    throw new Error("TELEGRAM_DELIVERY_MODE must be explicitly set to mock, live or disabled");
  if (["staging", "production"].includes(deployment)) {
    if (base.protocol !== "https:") throw new Error("Staging and production require an HTTPS APP_BASE_URL");
    if (role === "web" && !(env.AUTH_SESSION_COOKIE_NAME ?? "__Host-hker_session").startsWith("__Host-"))
      throw new Error("Staging and production require a __Host- session cookie name");
    if (!["true", "false"].includes(env.TRUST_PROXY_HEADERS ?? ""))
      throw new Error("Staging and production require an explicit TRUST_PROXY_HEADERS value");
    if (deliveryMode === "mock") throw new Error("Mock Telegram delivery is restricted to local/test environments");
  }
  const ttl = Number(env.AUTH_SESSION_TTL_DAYS ?? 30);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 365)
    throw new Error("AUTH_SESSION_TTL_DAYS must be 1–365");
  const cookie = env.AUTH_SESSION_COOKIE_NAME ?? "__Host-hker_session";
  if (role === "web" && !/^[A-Za-z0-9_-]+$/.test(cookie))
    throw new Error("Invalid session cookie name");
  if (role === "web" && cookie.startsWith("__Host-") && base.protocol !== "https:")
    throw new Error(
      "Host-prefixed session cookies require HTTPS; set a plain cookie name for local HTTP",
    );
  if (deliveryMode === "live" && !env.TELEGRAM_BOT_TOKEN)
    throw new Error("Live Telegram delivery needs a Bot token");
  if (role === "web" && deliveryMode === "live" && !env.TELEGRAM_WEBHOOK_SECRET)
    throw new Error("Live Telegram webhook needs a webhook secret");
  if (deployment === "staging" && deliveryMode === "live" && !env.TELEGRAM_TEST_CHAT_ID)
    throw new Error("Staging live delivery requires a dedicated TELEGRAM_TEST_CHAT_ID");
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
