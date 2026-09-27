const args = process.argv.slice(2);
const action = args[0] ?? "inspect";
const networkInspection = args.includes("--network");
const applying = args.includes("--apply");
const token = process.env.TELEGRAM_BOT_TOKEN;
const deployment = process.env.HKER_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "local");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const expectedUsername = process.env.TELEGRAM_EXPECTED_BOT_USERNAME?.replace(/^@/, "");
const target = process.env.TELEGRAM_WEBHOOK_URL;

function safeEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/api/telegram/webhook"
      ? url.toString()
      : null;
  } catch { return null; }
}
async function call(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) throw new Error(`Telegram ${method} network failure`);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(`Telegram ${method} rejected the request`);
  return result.result;
}
function print(value) { console.log(JSON.stringify(value, null, 2)); }

async function main() {
  if (!["inspect", "set-webhook"].includes(action)) throw new Error("Use inspect or set-webhook");
  const safeTarget = target ? safeEndpoint(target) : null;
  if (target && !safeTarget) throw new Error("TELEGRAM_WEBHOOK_URL must be an HTTPS /api/telegram/webhook URL without userinfo or query parameters");
  if (action === "inspect" && !networkInspection) {
    print({ status: "dry_run", action, deployment, mode: process.env.TELEGRAM_DELIVERY_MODE ?? "unset", tokenConfigured: Boolean(token), webhookSecretConfigured: Boolean(secret), targetConfigured: Boolean(safeTarget), networkContacted: false });
    return;
  }
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required in protected runtime input");
  const me = await call("getMe");
  const webhook = await call("getWebhookInfo");
  const identity = { botId: Number(me.id), username: typeof me.username === "string" ? me.username : null, isBot: Boolean(me.is_bot) };
  if (action === "inspect") {
    print({ status: "inspected", action, identity, webhook: { configured: Boolean(webhook.url), targetMatches: safeTarget ? webhook.url === safeTarget : null, pendingUpdateCount: Number(webhook.pending_update_count ?? 0), hasLastError: Boolean(webhook.last_error_message), maxConnections: Number(webhook.max_connections ?? 0) }, networkContacted: true });
    return;
  }
  if (!applying) {
    print({ status: "dry_run", action, identity, webhook: { configured: Boolean(webhook.url), targetMatches: safeTarget ? webhook.url === safeTarget : null, pendingUpdateCount: Number(webhook.pending_update_count ?? 0) }, targetConfigured: Boolean(safeTarget), wouldDropPendingUpdates: false, networkContacted: true, webhookMutation: false });
    return;
  }
  if (process.env.HKER_TELEGRAM_SETUP_ACK !== "I_AUTHORIZE_WEBHOOK_CHANGE")
    throw new Error("Webhook mutation requires HKER_TELEGRAM_SETUP_ACK=I_AUTHORIZE_WEBHOOK_CHANGE");
  if (!expectedUsername || me.username !== expectedUsername)
    throw new Error("The returned Bot identity does not match TELEGRAM_EXPECTED_BOT_USERNAME");
  if (!safeTarget || !secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret))
    throw new Error("A valid HTTPS target and Telegram webhook secret are required");
  if (webhook.url && webhook.url !== safeTarget && !args.includes("--replace-existing"))
    throw new Error("A different webhook is already configured; inspect it and explicitly pass --replace-existing only for the intended Bot");
  const response = await call("setWebhook", { url: safeTarget, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
  print({ status: response ? "webhook_configured" : "webhook_not_confirmed", action, identity, endpointMatchesTarget: true, pendingUpdatesDropped: false, secretHeaderStillRequiresApplicationTests: true, networkContacted: true });
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : "telegram_operations_failed" }));
  process.exitCode = 1;
});
