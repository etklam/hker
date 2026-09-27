import { sitemapCount, sitemapHeaders, sitemapPage } from "@/server/catalog/sitemap";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (process.env.HKER_ENVIRONMENT === "staging" || !/^(0|[1-9][0-9]{0,6})$/.test(page) || Number(page) >= await sitemapCount()) return new Response(null, { status: 404 });
  return new Response(await sitemapPage(Number(page)), { headers: sitemapHeaders });
}
