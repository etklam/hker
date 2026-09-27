import { after } from "next/server";
import { deliverCatalogUpdate } from "@/server/catalog/bot-delivery";
import { readJsonBody } from "@/server/catalog/http";
import {
  verifyWebhookSecret,
  telegramUpdateSchema,
  handleCatalogUpdate,
  acknowledgeCatalogCallback,
} from "@/server/catalog/bot";
export async function POST(req: Request) {
  if (!verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await readJsonBody(req, 64_000);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "Invalid update" }, { status: 400 });
  // Start the short callback acknowledgement before planning, without delaying HTTP acceptance.
  const acknowledgement = acknowledgeCatalogCallback(parsed.data);
  await handleCatalogUpdate(parsed.data, undefined, { delivery: "deferred", acknowledge: false });
  after(async () => {
    await acknowledgement;
    await deliverCatalogUpdate(parsed.data.update_id);
  });
  return Response.json({ ok: true });
}
