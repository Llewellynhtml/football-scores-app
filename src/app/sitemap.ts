import type { MetadataRoute } from "next";
import { getFootballLeagueCatalog } from "@/lib/football";
import { SPORTS } from "@/sports/registry";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "https://palegoldenrod-clam-775783.hostingersite.com";
  const now = new Date();

  let leagues = [];
  try {
    leagues = await getFootballLeagueCatalog();
  } catch {
    leagues = [];
  }

  return [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/sports`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/leagues`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/teams`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/sports/rugby/leagues`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...SPORTS.filter((sport) => sport.slug !== "football").map((sport) => ({
      url: `${base}/sports/${sport.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...leagues.flatMap((league) => {
      const entries: MetadataRoute.Sitemap = [
        {
          url: `${base}/leagues/${league.routeKey}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.7,
        },
      ];

      if (league.season.coverage.standings) {
        entries.push({
          url: `${base}/standings/${league.routeKey}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.65,
        });
      }

      return entries;
    }),
  ];
}
