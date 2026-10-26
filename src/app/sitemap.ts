import type { MetadataRoute } from "next";
import { FEATURED_COMPETITIONS } from "@/config/competitions";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL ?? "https://plum-trout-603701.hostingersite.com";
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/leagues`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/teams`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...FEATURED_COMPETITIONS.flatMap((competition) => [
      {
        url: `${base}/leagues/${competition.slug}`,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: 0.9,
      },
      {
        url: `${base}/standings/${competition.slug}`,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: 0.9,
      },
    ]),
  ];
}
