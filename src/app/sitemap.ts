import type { MetadataRoute } from "next";
import { FEATURED_COMPETITIONS } from "@/config/competitions";
import { SPORTS } from "@/sports/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL ?? "https://palegoldenrod-clam-775783.hostingersite.com";
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/sports`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/leagues`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/teams`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...SPORTS.filter((sport) => sport.slug !== "football").map((sport) => ({
      url: `${base}/sports/${sport.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
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
