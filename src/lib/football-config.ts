type SeasonLike = {
  year: number;
  current?: boolean;
};

export type FootballDataMode = "free" | "current";

function normalizedMode(): FootballDataMode {
  const raw = (
    process.env.API_FOOTBALL_DATA_MODE
    ?? process.env.API_FOOTBALL_PLAN
    ?? "free"
  ).trim().toLowerCase();

  return ["current", "paid", "pro", "ultra", "mega"].includes(raw)
    ? "current"
    : "free";
}

function configuredFreeSeason() {
  const raw = process.env.API_FOOTBALL_FREE_SEASON?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1900 || value > 2200) throw new Error("API_FOOTBALL_FREE_SEASON must be a four-digit year");
  return value;
}

export const FOOTBALL_DATA_MODE = normalizedMode();
export const FOOTBALL_FREE_SEASON = configuredFreeSeason();
export const FOOTBALL_SOURCE_TIMEZONE = (process.env.FOOTBALL_SOURCE_TIMEZONE ?? "UTC").trim() || "UTC";

export function footballCacheNamespace() {
  const baseUrl = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
  let providerOrigin: string;
  try { providerOrigin = new URL(baseUrl).origin; }
  catch { throw new Error("API_FOOTBALL_BASE_URL must be a valid URL"); }
  return JSON.stringify({
    schema: 2,
    providerOrigin,
    mode: FOOTBALL_DATA_MODE,
    freeSeason: FOOTBALL_FREE_SEASON ?? null,
    freeDateFrom: process.env.API_FOOTBALL_FREE_DATE_FROM ?? null,
    freeDateTo: process.env.API_FOOTBALL_FREE_DATE_TO ?? null,
    fixtureBatching: process.env.API_FOOTBALL_FIXTURE_BATCHING_ENABLED?.trim().toLowerCase() === "true",
  });
}

export function selectFootballSeason<T extends SeasonLike>(seasons: T[]): T | undefined {
  if (!seasons.length) return undefined;

  if (FOOTBALL_DATA_MODE === "current") {
    return seasons.find((season) => season.current)
      ?? seasons.slice().sort((a, b) => b.year - a.year)[0];
  }

  if (FOOTBALL_FREE_SEASON !== undefined) {
    return seasons.find((season) => season.year === FOOTBALL_FREE_SEASON)
      ?? seasons.filter((season) => season.year <= FOOTBALL_FREE_SEASON).sort((a, b) => b.year - a.year)[0];
  }
  return seasons.find((season) => season.current)
    ?? seasons.slice().sort((a, b) => b.year - a.year)[0];
}

export function footballQueryDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function fixtureDateAllowed(date: string, now = new Date()) {
  if (FOOTBALL_DATA_MODE === "current") return true;
  const configured = process.env.API_FOOTBALL_FREE_DATE_FROM && process.env.API_FOOTBALL_FREE_DATE_TO;
  if (!configured) return true;
  return date >= process.env.API_FOOTBALL_FREE_DATE_FROM! && date <= process.env.API_FOOTBALL_FREE_DATE_TO!;
}

export function footballDataContext() {
  return {
    mode: FOOTBALL_DATA_MODE,
    freeSeason: FOOTBALL_FREE_SEASON ?? null,
    sourceTimezone: FOOTBALL_SOURCE_TIMEZONE,
    isHistoricalDevelopmentData: FOOTBALL_DATA_MODE === "free",
  };
}
