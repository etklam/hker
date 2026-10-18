export function siteOrigin() {
  const configured = process.env.APP_BASE_URL;
  const environment =
    process.env.HKER_ENVIRONMENT ??
    (process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
      ? "production"
      : "local");
  if (!configured) {
    if (["production", "staging"].includes(environment))
      throw new Error("APP_BASE_URL required");
    return new URL("http://localhost:3000");
  }
  const url = new URL(configured);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid APP_BASE_URL origin");
  if (
    ["production", "staging"].includes(environment) &&
    url.protocol !== "https:"
  )
    throw new Error("HTTPS origin required");
  return url;
}
