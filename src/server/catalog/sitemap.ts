import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { listings } from "@/db/schema/directory";
import { siteOrigin } from "@/lib/site-origin";
export const SITEMAP_PAGE_SIZE = 45000;
const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
export async function sitemapCount() {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(listings).where(eq(listings.enabled, true));
  return Math.max(1, Math.ceil(row.count / SITEMAP_PAGE_SIZE));
}
export async function sitemapIndex() {
  const origin = siteOrigin();
  const count = await sitemapCount();
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: count }, (_, page) => `<sitemap><loc>${escapeXml(new URL(`/sitemaps/${page}`, origin).href)}</loc></sitemap>`).join("")}</sitemapindex>`;
}
export async function sitemapPage(page: number) {
  const origin = siteOrigin();
  const rows = await db.select({ slug: listings.slug }).from(listings).where(eq(listings.enabled, true)).orderBy(asc(listings.id)).limit(SITEMAP_PAGE_SIZE).offset(page * SITEMAP_PAGE_SIZE);
  const paths = [...(page === 0 ? ["/", "/categories", "/tags", "/about", "/privacy", "/correction"] : []), ...rows.map(row => `/listing/${row.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`).join("")}</urlset>`;
}
export const sitemapHeaders = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" };
