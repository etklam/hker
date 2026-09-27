import { sitemapHeaders, sitemapIndex } from "@/server/catalog/sitemap";
export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.HKER_ENVIRONMENT === "staging") return new Response(null, { status: 404 });
  return new Response(await sitemapIndex(), { headers: sitemapHeaders });
}
