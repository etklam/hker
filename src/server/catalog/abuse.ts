import { isIP } from "node:net";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { rateLimit } from "@/server/api-helpers";
import { AppError } from "@/lib/errors";
export function abuseKey(header: Headers, bucket: string) {
  // Deployment must overwrite this header; untrusted proxy headers are ignored by default.
  const candidate = header.get("x-real-ip") ?? "";
  const ip =
    process.env.TRUST_PROXY_HEADERS === "true" && isIP(candidate)
      ? candidate
      : "untrusted-shared";
  const day = new Date().toISOString().slice(0, 10);
  return `catalog:${bucket}:${createHmac(
    "sha256",
    process.env.AUTH_SESSION_SECRET ?? "local-development",
  )
    .update(`${day}:${ip}`)
    .digest("hex")}`;
}
export async function allowCatalogRequest(
  header: Headers,
  bucket: string,
  limit = 60,
) {
  return (await rateLimit(abuseKey(header, bucket), limit, 60_000)).allowed;
}
export async function guardPublicSearch() {
  if (!(await allowCatalogRequest(new Headers(await headers()), "search", 90)))
    throw new AppError("INVALID_REQUEST", "搜尋過於頻繁，請稍後再試。");
}
