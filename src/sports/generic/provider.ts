import { getSport, SPORTS } from "@/sports/registry";
import type { UnifiedSportEvent, SportApiStatus, EventValidationBatch } from "@/sports/generic/types";
import { accept, createDiagnostics, reject, validDateLike, validName, validNullableScore } from "@/lib/data-validation";

type JsonObject = Record<string, unknown>;

const MATCH_SPORTS = new Set([
  "basketball",
  "nba",
  "american-football",
  "baseball",
  "hockey",
  "volleyball",
  "handball",
  "afl",
]);

const FREE_TIER_REVALIDATE = 900;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function path(value: unknown, parts: string[]): unknown {
  let current: unknown = value;
  for (const part of parts) {
    const item = object(current);
    if (!item) return undefined;
    current = item[part];
  }
  return current;
}

function textValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numericValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function scoreValue(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "string") return String(value);
  const item = object(value);
  if (!item) return null;
  return textValue(item.total, item.points, item.score, item.runs, item.value);
}

function cleanMediaUrl(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getApiKey(slug: string) {
  const sport = getSport(slug);
  if (!sport) return undefined;
  return process.env[sport.apiKeyEnv]
    ?? process.env.API_SPORTS_KEY
    ?? process.env.API_FOOTBALL_KEY;
}

function getBaseUrl(slug: string) {
  const sport = getSport(slug);
  if (!sport) throw new Error(`Unknown sport: ${slug}`);
  return process.env[sport.baseUrlEnv] ?? sport.defaultBaseUrl;
}

async function apiArray(
  slug: string,
  endpoint: string,
  params: Record<string, string | number | undefined>,
  revalidate = FREE_TIER_REVALIDATE,
): Promise<unknown[]> {
  const key = getApiKey(slug);
  if (!key) return [];

  const url = new URL(endpoint, getBaseUrl(slug));
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    headers: { "x-apisports-key": key },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`${slug} API request failed with status ${response.status}`);
  }

  const payload = await response.json() as JsonObject;
  const result = payload.response;
  return Array.isArray(result) ? result : [];
}

function teamFrom(slug: string, raw: unknown, side: "home" | "away") {
  const visitorSide = side === "away" ? "visitors" : "home";
  const name = textValue(
    path(raw, ["teams", side, "name"]),
    path(raw, ["teams", visitorSide, "name"]),
    path(raw, ["team", side, "name"]),
  );
  if (!name) return null;

  return {
    name,
    logo: cleanMediaUrl(path(raw, ["teams", side, "logo"]))
      ?? cleanMediaUrl(path(raw, ["teams", visitorSide, "logo"]))
      ?? cleanMediaUrl(path(raw, ["team", side, "logo"])),
  };
}

function normalizeMatch(slug: string, raw: unknown): UnifiedSportEvent {
  const home = teamFrom(slug, raw, "home");
  const away = teamFrom(slug, raw, "away");

  const status = textValue(
    path(raw, ["status", "short"]),
    path(raw, ["status"]),
    path(raw, ["status", "long"]),
  ) ?? "";

  const date = textValue(
    path(raw, ["date", "start"]),
    path(raw, ["date"]),
  ) ?? "";

  return {
    id: textValue(path(raw, ["id"])) ?? "",
    sport: slug,
    date,
    time: textValue(path(raw, ["time"])),
    status,
    statusLong: textValue(path(raw, ["status", "long"]), status) ?? status,
    competition: textValue(
      path(raw, ["league", "name"]),
      path(raw, ["league"]),
      path(raw, ["competition", "name"]),
    ) ?? "",
    country: textValue(
      path(raw, ["country", "name"]),
      path(raw, ["league", "country", "name"]),
      path(raw, ["league", "country"]),
      path(raw, ["country"]),
    ),
    logo: cleanMediaUrl(path(raw, ["league", "logo"]))
      ?? cleanMediaUrl(path(raw, ["competition", "logo"])),
    home,
    away,
    homeScore: scoreValue(path(raw, ["scores", "home"]))
      ?? scoreValue(path(raw, ["scores", "home", "total"])),
    awayScore: scoreValue(path(raw, ["scores", "away"]))
      ?? scoreValue(path(raw, ["scores", "visitors"]))
      ?? scoreValue(path(raw, ["scores", "away", "total"]))
      ?? scoreValue(path(raw, ["scores", "visitors", "points"])),
    title: null,
    subtitle: null,
  };
}

function normalizeMma(raw: unknown): UnifiedSportEvent {
  const homeName = textValue(
    path(raw, ["fighters", "first", "name"]),
    path(raw, ["fighters", "home", "name"]),
    path(raw, ["fighters", "a", "name"]),
    path(raw, ["fighter", "first", "name"]),
  );
  const awayName = textValue(
    path(raw, ["fighters", "second", "name"]),
    path(raw, ["fighters", "away", "name"]),
    path(raw, ["fighters", "b", "name"]),
    path(raw, ["fighter", "second", "name"]),
  );
  const status = textValue(path(raw, ["status", "short"]), path(raw, ["status"])) ?? "";

  return {
    id: textValue(path(raw, ["id"])) ?? "",
    sport: "mma",
    date: textValue(path(raw, ["date"])) ?? "",
    time: textValue(path(raw, ["time"])),
    status,
    statusLong: textValue(path(raw, ["status", "long"]), status) ?? status,
    competition: textValue(
      path(raw, ["league", "name"]),
      path(raw, ["competition", "name"]),
      path(raw, ["category"]),
    ) ?? "",
    country: textValue(path(raw, ["country", "name"]), path(raw, ["country"])),
    logo: null,
    home: homeName ? { name: homeName, logo: cleanMediaUrl(path(raw, ["fighters", "first", "logo"])) } : null,
    away: awayName ? { name: awayName, logo: cleanMediaUrl(path(raw, ["fighters", "second", "logo"])) } : null,
    homeScore: null,
    awayScore: null,
    title: homeName && awayName ? null : textValue(path(raw, ["name"]), path(raw, ["event", "name"])),
    subtitle: textValue(path(raw, ["category"])),
  };
}

function normalizeRace(raw: unknown): UnifiedSportEvent {
  const date = textValue(path(raw, ["date"]), path(raw, ["date", "start"])) ?? "";
  return {
    id: textValue(path(raw, ["id"])) ?? "",
    sport: "formula-1",
    date,
    time: textValue(path(raw, ["time"])),
    status: textValue(path(raw, ["status"])) ?? "",
    statusLong: textValue(path(raw, ["status"])) ?? "",
    competition: textValue(
      path(raw, ["competition", "name"]),
      path(raw, ["season"]),
    ) ?? "",
    country: textValue(
      path(raw, ["circuit", "location", "country"]),
      path(raw, ["competition", "location", "country"]),
      path(raw, ["country"]),
    ),
    logo: cleanMediaUrl(path(raw, ["competition", "logo"])),
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    title: textValue(
      path(raw, ["competition", "name"]),
      path(raw, ["type"]),
      path(raw, ["name"]),
      path(raw, ["circuit", "name"]),
    ),
    subtitle: textValue(path(raw, ["circuit", "name"]), path(raw, ["type"])),
  };
}

export function sportHasKey(slug: string) {
  return Boolean(getApiKey(slug));
}

function validateEvent(event: UnifiedSportEvent, diagnostics: ReturnType<typeof createDiagnostics>) {
  if (!event.id.trim()) {
    reject(diagnostics, "missing_id");
    return false;
  }
  if (!validName(event.competition)) {
    reject(diagnostics, "invalid_competition");
    return false;
  }
  if (!validName(event.status)) {
    reject(diagnostics, "invalid_status");
    return false;
  }
  if (!validDateLike(event.date)) {
    reject(diagnostics, "invalid_date");
    return false;
  }
  if (!validNullableScore(event.homeScore) || !validNullableScore(event.awayScore)) {
    reject(diagnostics, "invalid_score");
    return false;
  }

  if (MATCH_SPORTS.has(event.sport)) {
    if (!event.home || !event.away || !validName(event.home.name) || !validName(event.away.name)) {
      reject(diagnostics, "missing_participant");
      return false;
    }
    if (event.home.name.trim().toLowerCase() === event.away.name.trim().toLowerCase()) {
      reject(diagnostics, "duplicate_participants");
      return false;
    }
  }

  if (event.sport === "mma") {
    const hasPair = Boolean(event.home && event.away && validName(event.home.name) && validName(event.away.name));
    const hasTitle = validName(event.title);
    if (!hasPair && !hasTitle) {
      reject(diagnostics, "missing_fight_identity");
      return false;
    }
  }

  if (event.sport === "formula-1" && !validName(event.title)) {
    reject(diagnostics, "missing_race_title");
    return false;
  }

  accept(diagnostics);
  return true;
}

export async function getEventsByDate(slug: string, date: string): Promise<EventValidationBatch> {
  let normalized: UnifiedSportEvent[] = [];

  if (MATCH_SPORTS.has(slug)) {
    const raw = await apiArray(slug, "/games", { date, timezone: "Africa/Johannesburg" });
    normalized = raw.map((item) => normalizeMatch(slug, item));
  } else if (slug === "mma") {
    const raw = await apiArray(slug, "/fights", { date, timezone: "Africa/Johannesburg" });
    normalized = raw.map(normalizeMma);
  } else if (slug === "formula-1") {
    const season = Number(date.slice(0, 4));
    const raw = await apiArray(slug, "/races", { season }, 21600);
    normalized = raw
      .map(normalizeRace)
      .filter((race) => race.date.slice(0, 10) === date);
  }

  const diagnostics = createDiagnostics(normalized.length);
  const events = normalized.filter((event) => validateEvent(event, diagnostics));
  return { events, diagnostics };
}

export async function checkSportStatus(slug: string): Promise<SportApiStatus> {
  const sport = getSport(slug);
  if (!sport) {
    return { slug, name: slug, configured: false, reachable: false, plan: null, used: null, limit: null, error: "Unknown sport" };
  }

  const key = getApiKey(slug);
  if (!key) {
    return { slug, name: sport.name, configured: false, reachable: false, plan: null, used: null, limit: null, error: null };
  }

  try {
    const response = await fetch(new URL("/status", getBaseUrl(slug)), {
      headers: { "x-apisports-key": key },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return { slug, name: sport.name, configured: true, reachable: false, plan: null, used: null, limit: null, error: `HTTP ${response.status}` };
    }

    const payload = await response.json() as JsonObject;
    const root = object(payload.response);
    const subscription = object(root?.subscription);
    const requests = object(root?.requests);

    return {
      slug,
      name: sport.name,
      configured: true,
      reachable: true,
      plan: textValue(subscription?.plan),
      used: numericValue(requests?.current),
      limit: numericValue(requests?.limit_day),
      error: null,
    };
  } catch (error) {
    return {
      slug,
      name: sport.name,
      configured: true,
      reachable: false,
      plan: null,
      used: null,
      limit: null,
      error: error instanceof Error ? error.message : "Status check failed",
    };
  }
}

export async function checkAllSportStatuses() {
  return Promise.all(SPORTS.map((sport) => checkSportStatus(sport.slug)));
}
