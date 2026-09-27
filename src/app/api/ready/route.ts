import { inspectDirectorySchema } from "@/server/catalog/schema-contract";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const schema = await inspectDirectorySchema("web");
    if (!schema.compatible)
      return Response.json(
        { status: "unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
