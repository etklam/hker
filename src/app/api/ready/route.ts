import { sql } from "drizzle-orm";
import { db } from "@/server/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.execute(sql`select revision from directory_listings limit 0`);
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
