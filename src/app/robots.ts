import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? "https://plum-trout-603701.hostingersite.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/cron/", "/api/usage"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
