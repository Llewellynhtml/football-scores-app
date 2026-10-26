export function getSiteUrl() {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  return "http://localhost:3000";
}
