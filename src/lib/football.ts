import { currentFootballSeason, getCompetition } from "@/config/competitions";
import { dateInSouthAfrica, shiftDate } from "@/lib/dates";
import { recordProviderResponse } from "@/lib/api-usage";

export type Fixture = {
  id: number;
  date: string;
  status: string;
  statusLong: string;
  elapsed: number | null;
  referee: string | null;
  venue: { name: string | null; city: string | null };
  league: { id: number; name: string; country: string; logo: string; season: number };
  home: { id: number; name: string; logo: string; goals: number | null };
  away: { id: number; name: string; logo: string; goals: number | null };
};

export type StandingRow = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type TeamProfile = {
  id: number;
  name: string;
  code: string | null;
  country: string;
  founded: number | null;
  national: boolean;
  logo: string;
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  } | null;
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    referee: string | null;
    status: { long: string; short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: { id: number; name: string; country: string; logo: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
};

type ApiStanding = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

type ApiTeam = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    national: boolean;
    logo: string;
  };
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  } | null;
};

type ApiResponse<T> = {
  response: T[];
  errors?: unknown;
};

const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

async function apiGet<T>(
  pathname: string,
  params: Record<string, string | number | undefined>,
  revalidate: number,
): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY ?? process.env.API_SPORTS_KEY;
  if (!key) return [];

  const url = new URL(pathname, BASE_URL);
  Object.entries(params).forEach(([keyName, value]) => {
    if (value !== undefined) url.searchParams.set(keyName, String(value));
  });

  const response = await fetch(url, {
    headers: { "x-apisports-key": key },
    next: { revalidate },
  });

  recordProviderResponse(response.headers);

  if (!response.ok) {
    throw new Error(`API-Football request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<T>;
  return data.response ?? [];
}

function mapFixture(item: ApiFootballFixture): Fixture {
  return {
    id: item.fixture.id,
    date: item.fixture.date,
    status: item.fixture.status.short,
    statusLong: item.fixture.status.long,
    elapsed: item.fixture.status.elapsed,
    referee: item.fixture.referee,
    venue: item.fixture.venue,
    league: item.league,
    home: { ...item.teams.home, goals: item.goals.home },
    away: { ...item.teams.away, goals: item.goals.away },
  };
}

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    { date, timezone: "Africa/Johannesburg" },
    1800,
  );
  return data.map(mapFixture);
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const data = await apiGet<ApiFootballFixture>("/fixtures", { id }, 900);
  return data[0] ? mapFixture(data[0]) : null;
}

export async function getLeagueFixtures(slug: string): Promise<Fixture[]> {
  const competition = getCompetition(slug);
  if (!competition) return [];

  const today = dateInSouthAfrica();
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    {
      league: competition.id,
      season: currentFootballSeason(),
      from: shiftDate(today, -7),
      to: shiftDate(today, 14),
      timezone: "Africa/Johannesburg",
    },
    1800,
  );

  return data.map(mapFixture);
}

export async function getStandings(slug: string): Promise<StandingRow[]> {
  const competition = getCompetition(slug);
  if (!competition) return [];

  const data = await apiGet<{
    league: { standings: ApiStanding[][] };
  }>(
    "/standings",
    { league: competition.id, season: currentFootballSeason() },
    21600,
  );

  const table = data[0]?.league.standings?.[0] ?? [];
  return table.map((row) => ({
    rank: row.rank,
    team: row.team,
    points: row.points,
    goalsDiff: row.goalsDiff,
    form: row.form,
    played: row.all.played,
    win: row.all.win,
    draw: row.all.draw,
    lose: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
  }));
}

export async function getTeamBySlug(slug: string): Promise<TeamProfile | null> {
  const search = slug.replace(/-/g, " ");
  const data = await apiGet<ApiTeam>("/teams", { search }, 43200);
  const item = data[0];
  if (!item) return null;

  return {
    ...item.team,
    venue: item.venue,
  };
}

export async function getTeamFixtures(teamId: number): Promise<Fixture[]> {
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    {
      team: teamId,
      season: currentFootballSeason(),
      next: 8,
      timezone: "Africa/Johannesburg",
    },
    900,
  );
  return data.map(mapFixture);
}
