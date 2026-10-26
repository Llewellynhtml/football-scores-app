import { currentFootballSeason, getCompetition } from "@/config/competitions";
import { dateInSouthAfrica, shiftDate } from "@/lib/dates";
import { recordProviderResponse } from "@/lib/api-usage";
import { validDateLike, validName, validNullableScore, validPositiveId } from "@/lib/data-validation";
import { slugify } from "@/lib/slug";

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

export type LeagueCoverage = {
  fixtures: {
    events: boolean;
    lineups: boolean;
    statistics_fixtures: boolean;
    statistics_players: boolean;
  };
  standings: boolean;
  players: boolean;
  top_scorers: boolean;
  top_assists: boolean;
  top_cards: boolean;
  injuries: boolean;
  predictions: boolean;
  odds: boolean;
};

export type LeagueMetadata = {
  id: number;
  name: string;
  type: string;
  logo: string;
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  season: {
    year: number;
    start: string | null;
    end: string | null;
    current: boolean;
    coverage: LeagueCoverage;
  };
};

export type LeagueCatalogItem = LeagueMetadata & {
  routeKey: string;
};

export type LeagueDataSnapshot = {
  slug: string;
  season: number;
  generatedAt: string;
  metadata: LeagueMetadata | null;
  teams: TeamProfile[];
  standings: StandingRow[];
  fixtures: Fixture[];
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

type ApiLeagueEnvelope = {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: Array<{
    year: number;
    start: string | null;
    end: string | null;
    current: boolean;
    coverage: LeagueCoverage;
  }>;
};

type ApiResponse<T> = {
  response?: T[];
  errors?: unknown;
  results?: number;
  paging?: { current?: number; total?: number };
};

const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

function hasApiErrors(errors: unknown) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors as Record<string, unknown>).length > 0;
  if (typeof errors === "string") return errors.trim().length > 0;
  return false;
}

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
  if (hasApiErrors(data.errors)) {
    throw new Error(`API-Football returned an error for ${pathname}`);
  }

  if (typeof data.results === "number" && data.results === 0) {
    return [];
  }

  return Array.isArray(data.response) ? data.response : [];
}

function mapFixture(item: ApiFootballFixture): Fixture | null {
  if (
    !validPositiveId(item?.fixture?.id)
    || !validDateLike(item?.fixture?.date)
    || !validName(item?.fixture?.status?.short)
    || !validPositiveId(item?.league?.id)
    || !validName(item?.league?.name)
    || !validPositiveId(item?.teams?.home?.id)
    || !validPositiveId(item?.teams?.away?.id)
    || !validName(item?.teams?.home?.name)
    || !validName(item?.teams?.away?.name)
    || !validNullableScore(item?.goals?.home)
    || !validNullableScore(item?.goals?.away)
  ) return null;

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

function validFixtures(data: ApiFootballFixture[]) {
  return data.map(mapFixture).filter((item): item is Fixture => item !== null);
}

function mapTeam(item: ApiTeam): TeamProfile | null {
  if (!validPositiveId(item?.team?.id) || !validName(item?.team?.name)) return null;
  return { ...item.team, venue: item.venue ?? null };
}

function mapLeague(item: ApiLeagueEnvelope, season: number): LeagueCatalogItem | null {
  if (!validPositiveId(item?.league?.id) || !validName(item?.league?.name)) return null;

  const seasonInfo = item.seasons?.find((entry) => entry.year === season)
    ?? item.seasons?.find((entry) => entry.current)
    ?? item.seasons?.[0];

  if (!seasonInfo) return null;

  return {
    id: item.league.id,
    name: item.league.name,
    type: item.league.type,
    logo: item.league.logo,
    country: item.country,
    season: seasonInfo,
    routeKey: `${slugify(item.league.name)}-${item.league.id}`,
  };
}

function fallbackFeaturedLeague(slug: string): LeagueCatalogItem | null {
  const competition = getCompetition(slug);
  if (!competition) return null;

  const season = currentFootballSeason();
  return {
    id: competition.id,
    name: competition.name,
    type: "League",
    logo: `https://media.api-sports.io/football/leagues/${competition.id}.png`,
    country: { name: competition.country, code: null, flag: null },
    season: {
      year: season,
      start: null,
      end: null,
      current: true,
      coverage: {
        fixtures: {
          events: false,
          lineups: false,
          statistics_fixtures: false,
          statistics_players: false,
        },
        standings: true,
        players: false,
        top_scorers: false,
        top_assists: false,
        top_cards: false,
        injuries: false,
        predictions: false,
        odds: false,
      },
    },
    routeKey: slug,
  };
}

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    { date, timezone: "Africa/Johannesburg" },
    1800,
  );
  return validFixtures(data);
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const data = await apiGet<ApiFootballFixture>("/fixtures", { id }, 900);
  return data[0] ? mapFixture(data[0]) : null;
}

export async function getFootballLeagueCatalog(): Promise<LeagueCatalogItem[]> {
  const season = currentFootballSeason();
  const data = await apiGet<ApiLeagueEnvelope>(
    "/leagues",
    { season },
    86400,
  );

  return data
    .map((item) => mapLeague(item, season))
    .filter((item): item is LeagueCatalogItem => item !== null)
    .sort((a, b) => {
      const country = a.country.name.localeCompare(b.country.name);
      return country !== 0 ? country : a.name.localeCompare(b.name);
    });
}

export async function resolveLeague(routeKey: string): Promise<LeagueCatalogItem | null> {
  const featured = getCompetition(routeKey);
  const catalog = await getFootballLeagueCatalog();

  if (featured) {
    return catalog.find((item) => item.id === featured.id)
      ? { ...catalog.find((item) => item.id === featured.id)!, routeKey }
      : fallbackFeaturedLeague(routeKey);
  }

  const match = routeKey.match(/-(\d+)$/);
  const id = match ? Number(match[1]) : null;
  if (!id) return null;

  return catalog.find((item) => item.id === id) ?? null;
}

export async function getLeagueMetadata(routeKey: string): Promise<LeagueMetadata | null> {
  return resolveLeague(routeKey);
}

async function getLeagueTeamsFor(ref: LeagueCatalogItem): Promise<TeamProfile[]> {
  const data = await apiGet<ApiTeam>(
    "/teams",
    { league: ref.id, season: ref.season.year },
    86400,
  );
  return data.map(mapTeam).filter((team): team is TeamProfile => team !== null);
}

async function getLeagueFixturesFor(ref: LeagueCatalogItem): Promise<Fixture[]> {
  const today = dateInSouthAfrica();
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    {
      league: ref.id,
      season: ref.season.year,
      from: shiftDate(today, -14),
      to: shiftDate(today, 30),
      timezone: "Africa/Johannesburg",
    },
    43200,
  );
  return validFixtures(data);
}

async function getStandingsFor(ref: LeagueCatalogItem): Promise<StandingRow[]> {
  if (!ref.season.coverage.standings) return [];

  const data = await apiGet<{
    league: { standings: ApiStanding[][] };
  }>(
    "/standings",
    { league: ref.id, season: ref.season.year },
    43200,
  );

  const table = data[0]?.league.standings?.[0] ?? [];
  return table
    .filter((row) => validPositiveId(row?.team?.id) && validName(row?.team?.name))
    .map((row) => ({
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

export async function getLeagueTeams(routeKey: string): Promise<TeamProfile[]> {
  const ref = await resolveLeague(routeKey);
  return ref ? getLeagueTeamsFor(ref) : [];
}

export async function getLeagueFixtures(routeKey: string): Promise<Fixture[]> {
  const ref = await resolveLeague(routeKey);
  return ref ? getLeagueFixturesFor(ref) : [];
}

export async function getStandings(routeKey: string): Promise<StandingRow[]> {
  const ref = await resolveLeague(routeKey);
  return ref ? getStandingsFor(ref) : [];
}

export async function getLeagueSnapshot(routeKey: string): Promise<LeagueDataSnapshot | null> {
  const ref = await resolveLeague(routeKey);
  if (!ref) return null;

  const [teams, standings, fixtures] = await Promise.all([
    getLeagueTeamsFor(ref),
    getStandingsFor(ref),
    getLeagueFixturesFor(ref),
  ]);

  return {
    slug: routeKey,
    season: ref.season.year,
    generatedAt: new Date().toISOString(),
    metadata: ref,
    teams,
    standings,
    fixtures,
  };
}

export async function getTeamBySlug(slug: string): Promise<TeamProfile | null> {
  const search = slug.replace(/-/g, " ");
  const data = await apiGet<ApiTeam>("/teams", { search }, 43200);
  const item = data[0];
  return item ? mapTeam(item) : null;
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
    1800,
  );
  return validFixtures(data);
}
