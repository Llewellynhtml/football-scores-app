export type Fixture = {
  id: number;
  date: string;
  status: string;
  elapsed: number | null;
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
  };
  home: {
    id: number;
    name: string;
    logo: string;
    goals: number | null;
  };
  away: {
    id: number;
    name: string;
    logo: string;
    goals: number | null;
  };
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

type ApiResponse<T> = {
  response: T[];
  errors?: Record<string, string>;
};

const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];

  const url = new URL("/fixtures", BASE_URL);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", "Africa/Johannesburg");

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": key,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<ApiFootballFixture>;

  return data.response.map((item) => ({
    id: item.fixture.id,
    date: item.fixture.date,
    status: item.fixture.status.short,
    elapsed: item.fixture.status.elapsed,
    league: item.league,
    home: {
      ...item.teams.home,
      goals: item.goals.home,
    },
    away: {
      ...item.teams.away,
      goals: item.goals.away,
    },
  }));
}
