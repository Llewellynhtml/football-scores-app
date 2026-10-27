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
  const raw = Number(process.env.API_FOOTBALL_FREE_SEASON ?? "2024");
  return Number.isInteger(raw) && raw >= 1900 && raw <= 2200 ? raw : 2024;
}

export const FOOTBALL_DATA_MODE = normalizedMode();
export const FOOTBALL_FREE_SEASON = configuredFreeSeason();
export const FOOTBALL_SOURCE_TIMEZONE = "UTC";

export function selectFootballSeason<T extends SeasonLike>(seasons: T[]): T | undefined {
  if (!seasons.length) return undefined;

  if (FOOTBALL_DATA_MODE === "current") {
    return seasons.find((season) => season.current)
      ?? seasons.slice().sort((a, b) => b.year - a.year)[0];
  }

  return seasons.find((season) => season.year === FOOTBALL_FREE_SEASON)
    ?? seasons
      .filter((season) => season.year <= FOOTBALL_FREE_SEASON)
      .sort((a, b) => b.year - a.year)[0];
}

export function footballQueryDate(date = new Date()) {
  const utcMonth = date.getUTCMonth();
  const utcDay = date.getUTCDate();

  if (FOOTBALL_DATA_MODE === "current") {
    return date.toISOString().slice(0, 10);
  }

  const candidate = new Date(Date.UTC(FOOTBALL_FREE_SEASON, utcMonth, utcDay, 12));
  if (candidate.getUTCMonth() !== utcMonth) {
    const lastDay = new Date(Date.UTC(FOOTBALL_FREE_SEASON, utcMonth + 1, 0, 12));
    return lastDay.toISOString().slice(0, 10);
  }

  return candidate.toISOString().slice(0, 10);
}

export function footballDataContext() {
  return {
    mode: FOOTBALL_DATA_MODE,
    freeSeason: FOOTBALL_FREE_SEASON,
    sourceTimezone: FOOTBALL_SOURCE_TIMEZONE,
    isHistoricalDevelopmentData: FOOTBALL_DATA_MODE === "free",
  };
}
