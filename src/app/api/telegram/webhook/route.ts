import {
  verifyWebhookSecret,
  telegramUpdateSchema,
  handleCatalogUpdate,
} from "@/server/catalog/bot";
export async function POST(req: Request) {
  if (!verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "Invalid update" }, { status: 400 });
  await handleCatalogUpdate(parsed.data);
  return Response.json({ ok: true });
}
