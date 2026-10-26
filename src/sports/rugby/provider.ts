import { recordProviderResponse } from "@/lib/api-usage";
import type { RugbyGame, RugbyLeague, RugbyStandingRow } from "@/sports/rugby/types";

type ApiResponse<T> = {
  response?: T[];
  errors?: unknown;
};

type RawGame = {
  id: number;
  date?: string;
  time?: string | null;
  timestamp?: number | null;
  timezone?: string | null;
  status?: { short?: string; long?: string } | string;
  league?: {
    id?: number;
    name?: string;
    type?: string | null;
    logo?: string | null;
    season?: number | null;
    country?: { name?: string | null; code?: string | null; flag?: string | null } | string | null;
  };
  teams?: {
    home?: { id?: number; name?: string; logo?: string | null };
    away?: { id?: number; name?: string; logo?: string | null };
  };
  scores?: {
    home?: number | null;
    away?: number | null;
  };
};

type RawLeague = {
  id: number;
  name: string;
  type?: string | null;
  logo?: string | null;
  country?: RugbyLeague["country"];
  seasons?: RugbyLeague["seasons"];
};

type RawStanding = {
  position?: number;
  rank?: number;
  team: { id: number; name: string; logo?: string | null };
  games?: { played?: number; win?: number; draw?: number; lose?: number };
  all?: { played?: number; win?: number; draw?: number; lose?: number };
  points?: number;
  goalsDiff?: number | null;
  form?: string | null;
};

const BASE_URL = process.env.API_RUGBY_BASE_URL ?? "https://v1.rugby.api-sports.io";

function key() {
  return process.env.API_RUGBY_KEY ?? process.env.API_SPORTS_KEY ?? process.env.API_FOOTBALL_KEY;
}

async function apiGet<T>(
  pathname: string,
  params: Record<string, string | number | undefined>,
  revalidate: number,
): Promise<T[]> {
  const apiKey = key();
  if (!apiKey) return [];

  const url = new URL(pathname, BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    next: { revalidate },
  });

  recordProviderResponse(response.headers);

  if (!response.ok) {
    throw new Error(`API-Rugby request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (payload.errors && Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error("API-Rugby returned an error response");
  }

  return payload.response ?? [];
}

function normalizeStatus(status: RawGame["status"]) {
  if (typeof status === "string") return { short: status, long: status };
  return {
    short: status?.short ?? "TBD",
    long: status?.long ?? status?.short ?? "To be determined",
  };
}

type RugbyCountry = { name?: string | null; code?: string | null; flag?: string | null } | string | null | undefined;

function countryObject(country: RugbyCountry) {
  if (!country) return null;
  if (typeof country === "string") return { name: country, code: null, flag: null };
  return {
    name: country.name ?? null,
    code: country.code ?? null,
    flag: country.flag ?? null,
  };
}

function mapGame(game: RawGame): RugbyGame {
  return {
    id: game.id,
    date: game.date ?? "",
    time: game.time ?? null,
    timestamp: game.timestamp ?? null,
    timezone: game.timezone ?? null,
    status: normalizeStatus(game.status),
    league: {
      id: game.league?.id ?? 0,
      name: game.league?.name ?? "Rugby",
      type: game.league?.type ?? null,
      logo: game.league?.logo ?? null,
      country: countryObject(game.league?.country),
      season: game.league?.season ?? null,
    },
    home: {
      id: game.teams?.home?.id ?? 0,
      name: game.teams?.home?.name ?? "Home",
      logo: game.teams?.home?.logo ?? null,
      score: game.scores?.home ?? null,
    },
    away: {
      id: game.teams?.away?.id ?? 0,
      name: game.teams?.away?.name ?? "Away",
      logo: game.teams?.away?.logo ?? null,
      score: game.scores?.away ?? null,
    },
  };
}

export function rugbyConfigured() {
  return Boolean(key());
}

export async function getRugbyGamesByDate(date: string) {
  const data = await apiGet<RawGame>("/games", { date, timezone: "Africa/Johannesburg" }, 900);
  return data.map(mapGame);
}

export async function getRugbyGameById(id: number) {
  const data = await apiGet<RawGame>("/games", { id }, 900);
  return data[0] ? mapGame(data[0]) : null;
}

export async function getRugbyLeagues() {
  return apiGet<RawLeague>("/leagues", {}, 86400);
}

export async function getRugbyLeagueGames(league: number, season?: number) {
  const data = await apiGet<RawGame>("/games", { league, season }, 1800);
  return data.map(mapGame);
}

export async function getRugbyStandings(league: number, season: number): Promise<RugbyStandingRow[]> {
  const data = await apiGet<{ league?: { standings?: RawStanding[][] } }>(
    "/standings",
    { league, season },
    21600,
  );

  const table = data[0]?.league?.standings?.[0] ?? [];
  return table.map((row, index) => ({
    position: row.position ?? row.rank ?? index + 1,
    team: row.team,
    games: {
      played: row.games?.played ?? row.all?.played ?? 0,
      win: row.games?.win ?? row.all?.win ?? 0,
      draw: row.games?.draw ?? row.all?.draw ?? 0,
      lose: row.games?.lose ?? row.all?.lose ?? 0,
    },
    points: row.points ?? 0,
    goalsDiff: row.goalsDiff ?? null,
    form: row.form ?? null,
  }));
}
