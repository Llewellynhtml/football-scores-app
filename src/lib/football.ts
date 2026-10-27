import { dateInSouthAfrica, shiftDate } from "@/lib/dates";
import { recordProviderResponse } from "@/lib/api-usage";
import { validDateLike, validName, validNullableScore, validPositiveId } from "@/lib/data-validation";
import { slugify } from "@/lib/slug";

export type FixtureEvent = {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number | null; name: string | null; logo: string | null };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string | null;
  detail: string | null;
  comments: string | null;
};

export type FixtureLineupPlayer = {
  id: number | null;
  name: string | null;
  number: number | null;
  pos: string | null;
  grid: string | null;
};

export type FixtureLineup = {
  team: { id: number | null; name: string | null; logo: string | null };
  formation: string | null;
  coach: { id: number | null; name: string | null; photo: string | null };
  startXI: FixtureLineupPlayer[];
  substitutes: FixtureLineupPlayer[];
};

export type FixtureTeamStatistics = {
  team: { id: number | null; name: string | null; logo: string | null };
  statistics: Array<{ type: string; value: string | number | null }>;
};

export type FixturePlayerPerformance = {
  player: { id: number | null; name: string | null; photo: string | null };
  games: {
    minutes: number | null;
    number: number | null;
    position: string | null;
    rating: string | null;
    captain: boolean | null;
    substitute: boolean | null;
  };
  offsides: number | null;
  shots: { total: number | null; on: number | null };
  goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
  passes: { total: number | null; key: number | null; accuracy: string | number | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null; past: number | null };
  fouls: { drawn: number | null; committed: number | null };
  cards: { yellow: number | null; red: number | null };
  penalty: {
    won: number | null;
    committed: number | null;
    scored: number | null;
    missed: number | null;
    saved: number | null;
  };
};

export type FixturePlayerStatistics = {
  team: { id: number | null; name: string | null; logo: string | null };
  players: FixturePlayerPerformance[];
};

export type Fixture = {
  id: number;
  date: string;
  status: string;
  statusLong: string;
  elapsed: number | null;
  extra: number | null;
  timezone: string | null;
  timestamp: number | null;
  periods: { first: number | null; second: number | null };
  referee: string | null;
  venue: { name: string | null; city: string | null };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string | null;
  };
  home: { id: number; name: string; logo: string; winner: boolean | null; goals: number | null };
  away: { id: number; name: string; logo: string; winner: boolean | null; goals: number | null };
  scoreBreakdown: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  events: FixtureEvent[];
  lineups: FixtureLineup[];
  statistics: FixtureTeamStatistics[];
  players: FixturePlayerStatistics[];
};

export type FixtureCompetition = {
  id: number;
  name: string;
  country: string;
  logo: string;
  season: number;
  routeKey: string;
};

export type StandingRecord = {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type StandingRow = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string | null;
  form: string | null;
  status: string | null;
  description: string | null;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  home: StandingRecord;
  away: StandingRecord;
  update: string | null;
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
  metadata: LeagueMetadata;
  teams: TeamProfile[];
  standings: StandingRow[];
  fixtures: Fixture[];
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    referee: string | null;
    timezone: string | null;
    timestamp: number | null;
    periods: { first: number | null; second: number | null };
    status: { long: string; short: string; elapsed: number | null; extra: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string | null;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  events?: Array<{
    time?: { elapsed?: number | null; extra?: number | null };
    team?: { id?: number | null; name?: string | null; logo?: string | null };
    player?: { id?: number | null; name?: string | null };
    assist?: { id?: number | null; name?: string | null };
    type?: string | null;
    detail?: string | null;
    comments?: string | null;
  }>;
  lineups?: Array<{
    team?: { id?: number | null; name?: string | null; logo?: string | null };
    formation?: string | null;
    coach?: { id?: number | null; name?: string | null; photo?: string | null };
    startXI?: Array<{ player?: { id?: number | null; name?: string | null; number?: number | null; pos?: string | null; grid?: string | null } }>;
    substitutes?: Array<{ player?: { id?: number | null; name?: string | null; number?: number | null; pos?: string | null; grid?: string | null } }>;
  }>;
  statistics?: Array<{
    team?: { id?: number | null; name?: string | null; logo?: string | null };
    statistics?: Array<{ type?: string | null; value?: string | number | null }>;
  }>;
  players?: Array<{
    team?: { id?: number | null; name?: string | null; logo?: string | null };
    players?: Array<{
      player?: { id?: number | null; name?: string | null; photo?: string | null };
      statistics?: Array<{
        games?: {
          minutes?: number | null;
          number?: number | null;
          position?: string | null;
          rating?: string | null;
          captain?: boolean | null;
          substitute?: boolean | null;
        };
        offsides?: number | null;
        shots?: { total?: number | null; on?: number | null };
        goals?: { total?: number | null; conceded?: number | null; assists?: number | null; saves?: number | null };
        passes?: { total?: number | null; key?: number | null; accuracy?: string | number | null };
        tackles?: { total?: number | null; blocks?: number | null; interceptions?: number | null };
        duels?: { total?: number | null; won?: number | null };
        dribbles?: { attempts?: number | null; success?: number | null; past?: number | null };
        fouls?: { drawn?: number | null; committed?: number | null };
        cards?: { yellow?: number | null; red?: number | null };
        penalty?: {
          won?: number | null;
          committed?: number | null;
          scored?: number | null;
          missed?: number | null;
          saved?: number | null;
        };
      }>;
    }>;
  }>;
};

type ApiStandingRecord = {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: { for: number; against: number };
};

type ApiStanding = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string | null;
  form: string | null;
  status: string | null;
  description: string | null;
  all: ApiStandingRecord;
  home: ApiStandingRecord;
  away: ApiStandingRecord;
  update: string | null;
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
const TIMEZONE = process.env.FOOTBALL_TIMEZONE ?? "Africa/Johannesburg";

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

  if (typeof data.results === "number" && data.results === 0) return [];
  return Array.isArray(data.response) ? data.response : [];
}

function mapLineupPlayer(entry: { player?: { id?: number | null; name?: string | null; number?: number | null; pos?: string | null; grid?: string | null } }): FixtureLineupPlayer {
  return {
    id: entry.player?.id ?? null,
    name: entry.player?.name ?? null,
    number: entry.player?.number ?? null,
    pos: entry.player?.pos ?? null,
    grid: entry.player?.grid ?? null,
  };
}

function mapPlayerPerformance(entry: NonNullable<NonNullable<ApiFootballFixture["players"]>[number]["players"]>[number]): FixturePlayerPerformance {
  const stats = entry.statistics?.[0] ?? {};
  return {
    player: {
      id: entry.player?.id ?? null,
      name: entry.player?.name ?? null,
      photo: entry.player?.photo ?? null,
    },
    games: {
      minutes: stats.games?.minutes ?? null,
      number: stats.games?.number ?? null,
      position: stats.games?.position ?? null,
      rating: stats.games?.rating ?? null,
      captain: stats.games?.captain ?? null,
      substitute: stats.games?.substitute ?? null,
    },
    offsides: stats.offsides ?? null,
    shots: { total: stats.shots?.total ?? null, on: stats.shots?.on ?? null },
    goals: {
      total: stats.goals?.total ?? null,
      conceded: stats.goals?.conceded ?? null,
      assists: stats.goals?.assists ?? null,
      saves: stats.goals?.saves ?? null,
    },
    passes: {
      total: stats.passes?.total ?? null,
      key: stats.passes?.key ?? null,
      accuracy: stats.passes?.accuracy ?? null,
    },
    tackles: {
      total: stats.tackles?.total ?? null,
      blocks: stats.tackles?.blocks ?? null,
      interceptions: stats.tackles?.interceptions ?? null,
    },
    duels: { total: stats.duels?.total ?? null, won: stats.duels?.won ?? null },
    dribbles: {
      attempts: stats.dribbles?.attempts ?? null,
      success: stats.dribbles?.success ?? null,
      past: stats.dribbles?.past ?? null,
    },
    fouls: { drawn: stats.fouls?.drawn ?? null, committed: stats.fouls?.committed ?? null },
    cards: { yellow: stats.cards?.yellow ?? null, red: stats.cards?.red ?? null },
    penalty: {
      won: stats.penalty?.won ?? null,
      committed: stats.penalty?.committed ?? null,
      scored: stats.penalty?.scored ?? null,
      missed: stats.penalty?.missed ?? null,
      saved: stats.penalty?.saved ?? null,
    },
  };
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
    || !validNullableScore(item?.score?.halftime?.home)
    || !validNullableScore(item?.score?.halftime?.away)
    || !validNullableScore(item?.score?.fulltime?.home)
    || !validNullableScore(item?.score?.fulltime?.away)
    || !validNullableScore(item?.score?.extratime?.home)
    || !validNullableScore(item?.score?.extratime?.away)
    || !validNullableScore(item?.score?.penalty?.home)
    || !validNullableScore(item?.score?.penalty?.away)
  ) return null;

  return {
    id: item.fixture.id,
    date: item.fixture.date,
    status: item.fixture.status.short,
    statusLong: item.fixture.status.long,
    elapsed: item.fixture.status.elapsed,
    extra: item.fixture.status.extra ?? null,
    timezone: item.fixture.timezone ?? null,
    timestamp: item.fixture.timestamp ?? null,
    periods: {
      first: item.fixture.periods?.first ?? null,
      second: item.fixture.periods?.second ?? null,
    },
    referee: item.fixture.referee,
    venue: item.fixture.venue,
    league: {
      ...item.league,
      flag: item.league.flag ?? null,
      round: item.league.round ?? null,
    },
    home: { ...item.teams.home, winner: item.teams.home.winner ?? null, goals: item.goals.home },
    away: { ...item.teams.away, winner: item.teams.away.winner ?? null, goals: item.goals.away },
    scoreBreakdown: {
      halftime: {
        home: item.score?.halftime?.home ?? null,
        away: item.score?.halftime?.away ?? null,
      },
      fulltime: {
        home: item.score?.fulltime?.home ?? null,
        away: item.score?.fulltime?.away ?? null,
      },
      extratime: {
        home: item.score?.extratime?.home ?? null,
        away: item.score?.extratime?.away ?? null,
      },
      penalty: {
        home: item.score?.penalty?.home ?? null,
        away: item.score?.penalty?.away ?? null,
      },
    },
    events: (item.events ?? []).map((event) => ({
      time: { elapsed: event.time?.elapsed ?? null, extra: event.time?.extra ?? null },
      team: {
        id: event.team?.id ?? null,
        name: event.team?.name ?? null,
        logo: event.team?.logo ?? null,
      },
      player: { id: event.player?.id ?? null, name: event.player?.name ?? null },
      assist: { id: event.assist?.id ?? null, name: event.assist?.name ?? null },
      type: event.type ?? null,
      detail: event.detail ?? null,
      comments: event.comments ?? null,
    })),
    lineups: (item.lineups ?? []).map((lineup) => ({
      team: {
        id: lineup.team?.id ?? null,
        name: lineup.team?.name ?? null,
        logo: lineup.team?.logo ?? null,
      },
      formation: lineup.formation ?? null,
      coach: {
        id: lineup.coach?.id ?? null,
        name: lineup.coach?.name ?? null,
        photo: lineup.coach?.photo ?? null,
      },
      startXI: (lineup.startXI ?? []).map(mapLineupPlayer),
      substitutes: (lineup.substitutes ?? []).map(mapLineupPlayer),
    })),
    statistics: (item.statistics ?? []).map((teamStats) => ({
      team: {
        id: teamStats.team?.id ?? null,
        name: teamStats.team?.name ?? null,
        logo: teamStats.team?.logo ?? null,
      },
      statistics: (teamStats.statistics ?? [])
        .filter((stat): stat is { type: string; value?: string | number | null } => typeof stat.type === "string")
        .map((stat) => ({ type: stat.type, value: stat.value ?? null })),
    })),
    players: (item.players ?? []).map((teamPlayers) => ({
      team: {
        id: teamPlayers.team?.id ?? null,
        name: teamPlayers.team?.name ?? null,
        logo: teamPlayers.team?.logo ?? null,
      },
      players: (teamPlayers.players ?? []).map(mapPlayerPerformance),
    })),
  };
}

function validFixtures(data: ApiFootballFixture[]) {
  return data.map(mapFixture).filter((item): item is Fixture => item !== null);
}

function mapTeam(item: ApiTeam): TeamProfile | null {
  if (!validPositiveId(item?.team?.id) || !validName(item?.team?.name)) return null;
  return { ...item.team, venue: item.venue ?? null };
}

function mapLeague(item: ApiLeagueEnvelope): LeagueCatalogItem | null {
  if (!validPositiveId(item?.league?.id) || !validName(item?.league?.name)) return null;

  const season = item.seasons?.find((entry) => entry.current)
    ?? item.seasons?.slice().sort((a, b) => b.year - a.year)[0];

  if (!season) return null;

  return {
    id: item.league.id,
    name: item.league.name,
    type: item.league.type,
    logo: item.league.logo,
    country: item.country,
    season,
    routeKey: `${slugify(item.league.name)}-${item.league.id}`,
  };
}

export function competitionsFromFixtures(fixtures: Fixture[]): FixtureCompetition[] {
  const map = new Map<number, FixtureCompetition>();

  for (const fixture of fixtures) {
    if (!map.has(fixture.league.id)) {
      map.set(fixture.league.id, {
        id: fixture.league.id,
        name: fixture.league.name,
        country: fixture.league.country,
        logo: fixture.league.logo,
        season: fixture.league.season,
        routeKey: `${slugify(fixture.league.name)}-${fixture.league.id}`,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    const country = a.country.localeCompare(b.country);
    return country !== 0 ? country : a.name.localeCompare(b.name);
  });
}

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    { date, timezone: TIMEZONE },
    1800,
  );
  return validFixtures(data);
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const data = await apiGet<ApiFootballFixture>("/fixtures", { id }, 900);
  return data[0] ? mapFixture(data[0]) : null;
}

export async function getFootballLeagueCatalog(): Promise<LeagueCatalogItem[]> {
  const data = await apiGet<ApiLeagueEnvelope>(
    "/leagues",
    { current: "true" },
    86400,
  );

  return data
    .map(mapLeague)
    .filter((item): item is LeagueCatalogItem => item !== null)
    .sort((a, b) => {
      const country = a.country.name.localeCompare(b.country.name);
      return country !== 0 ? country : a.name.localeCompare(b.name);
    });
}

export async function resolveLeague(routeKey: string): Promise<LeagueCatalogItem | null> {
  const catalog = await getFootballLeagueCatalog();

  const exact = catalog.find((item) => item.routeKey === routeKey);
  if (exact) return exact;

  const idMatch = routeKey.match(/-(\d+)$/);
  if (idMatch) {
    const id = Number(idMatch[1]);
    const byId = catalog.find((item) => item.id === id);
    if (byId) return byId;
  }

  return catalog.find((item) => slugify(item.name) === routeKey) ?? null;
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
      timezone: TIMEZONE,
    },
    43200,
  );
  return validFixtures(data);
}

async function getStandingsFor(ref: LeagueCatalogItem): Promise<StandingRow[]> {
  if (!ref.season.coverage.standings) return [];

  const data = await apiGet<{ league: { standings: ApiStanding[][] } }>(
    "/standings",
    { league: ref.id, season: ref.season.year },
    43200,
  );

  const tables = data[0]?.league.standings ?? [];
  return tables
    .flat()
    .filter((row) => validPositiveId(row?.team?.id) && validName(row?.team?.name))
    .map((row) => ({
      rank: row.rank,
      team: row.team,
      points: row.points,
      goalsDiff: row.goalsDiff,
      group: row.group ?? null,
      form: row.form ?? null,
      status: row.status ?? null,
      description: row.description ?? null,
      played: row.all.played,
      win: row.all.win,
      draw: row.all.draw,
      lose: row.all.lose,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      home: {
        played: row.home.played,
        win: row.home.win,
        draw: row.home.draw,
        lose: row.home.lose,
        goalsFor: row.home.goals.for,
        goalsAgainst: row.home.goals.against,
      },
      away: {
        played: row.away.played,
        win: row.away.win,
        draw: row.away.draw,
        lose: row.away.lose,
        goalsFor: row.away.goals.for,
        goalsAgainst: row.away.goals.against,
      },
      update: row.update ?? null,
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

export async function searchTeams(query: string): Promise<TeamProfile[]> {
  const search = query.trim();
  if (search.length < 3) return [];

  const data = await apiGet<ApiTeam>("/teams", { search }, 86400);
  return data
    .map(mapTeam)
    .filter((team): team is TeamProfile => team !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamBySlug(slug: string): Promise<TeamProfile | null> {
  const search = slug.replace(/-/g, " ");
  const data = await apiGet<ApiTeam>("/teams", { search }, 43200);
  const teams = data
    .map(mapTeam)
    .filter((team): team is TeamProfile => team !== null);

  return teams.find((team) => slugify(team.name) === slug) ?? null;
}

export async function getTeamFixtures(teamId: number): Promise<Fixture[]> {
  const data = await apiGet<ApiFootballFixture>(
    "/fixtures",
    { team: teamId, next: 8, timezone: TIMEZONE },
    1800,
  );
  return validFixtures(data);
}
