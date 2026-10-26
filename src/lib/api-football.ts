import type { ApiFootballResponse, Fixture } from "@/types/football";

const API_BASE_URL = "https://v3.football.api-sports.io";
const DEFAULT_TIMEZONE = "Africa/Johannesburg";

function getApiKey() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  return key;
}

function todayInTimezone(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function apiFootballFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  revalidate = 900,
): Promise<ApiFootballResponse<T> | null> {
  const key = getApiKey();
  if (!key) return null;

  const url = new URL(`${API_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([name, value]) =>
    url.searchParams.set(name, value),
  );

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": key,
    },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed with status ${response.status}`);
  }

  return (await response.json()) as ApiFootballResponse<T>;
}

export async function getTodayFixtures(): Promise<Fixture[]> {
  const timezone = process.env.FOOTBALL_TIMEZONE || DEFAULT_TIMEZONE;
  const date = todayInTimezone(timezone);

  try {
    const data = await apiFootballFetch<Fixture>(
      "fixtures",
      { date, timezone },
      900,
    );

    return data?.response ?? [];
  } catch (error) {
    console.error("Unable to load today's fixtures", error);
    return [];
  }
}
