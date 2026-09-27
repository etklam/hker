import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const environment = process.env.HKER_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "local");
  if (environment === "staging")
    return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" } };
}
