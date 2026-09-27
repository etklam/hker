import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { enabledOutboundLink, recordCatalogEvent } from '@/server/catalog/analytics';
import { allowCatalogRequest } from '@/server/catalog/abuse';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) return new Response(null, { status: 404 });
  const link = await enabledOutboundLink(Number(id));
  if (!link) return new Response(null, { status: 404 });
  // Metrics run after the response, so a slow analytics store cannot delay navigation.
  after(async () => {
    if (await allowCatalogRequest(req.headers, 'outbound', 60).catch(() => false))
      await recordCatalogEvent({ kind: 'outbound', key: id, source: 'web', actionId: randomUUID() });
  });
  return new Response(null, { status: 302, headers: { Location: link.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
