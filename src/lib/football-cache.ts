import { createHash } from "node:crypto";

export type ValidatedCacheResponse = { response: unknown[]; stale: boolean; expiresAt: string; staleUntil: string; updatedAt: string | null };
export type CacheRow = { payload: unknown; expires_at: unknown; stale_until: unknown; updated_at?: unknown };

export type CachePolicy = { ttlSeconds: number; staleSeconds: number };

export function cachePolicy(pathname: string, params: Record<string, string | number | undefined>, mode: string): CachePolicy {
  if (pathname === "/fixtures") {
    if (params.live !== undefined) return { ttlSeconds: 20, staleSeconds: 60 };
    if (typeof params.status === "string" && /^(FT|AET|PEN)(-|$)/.test(params.status)) return { ttlSeconds: 21600, staleSeconds: 86400 };
    if (typeof params.date === "string" && params.date < new Date().toISOString().slice(0, 10)) return { ttlSeconds: 21600, staleSeconds: 604800 };
    if (params.id !== undefined) return { ttlSeconds: mode === "current" ? 60 : 900, staleSeconds: mode === "current" ? 120 : 3600 };
    if (params.date !== undefined) return { ttlSeconds: mode === "current" ? 60 : 900, staleSeconds: mode === "current" ? 120 : 3600 };
    return { ttlSeconds: 300, staleSeconds: 900 };
  }
  if (pathname === "/fixtures/events") return { ttlSeconds: 30, staleSeconds: 120 };
  if (pathname === "/fixtures/lineups") return { ttlSeconds: 120, staleSeconds: 600 };
  if (pathname === "/fixtures/statistics" || pathname === "/fixtures/players") return { ttlSeconds: 60, staleSeconds: 300 };
  if (pathname === "/standings") return { ttlSeconds: 1800, staleSeconds: 21600 };
  if (pathname === "/leagues") return { ttlSeconds: 86400, staleSeconds: 604800 };
  if (pathname === "/teams" || pathname === "/players") return { ttlSeconds: 43200, staleSeconds: 259200 };
  if (pathname === "/injuries") return { ttlSeconds: 14400, staleSeconds: 43200 };
  if (pathname === "/transfers") return { ttlSeconds: 86400, staleSeconds: 604800 };
  if (pathname === "/predictions") return { ttlSeconds: 3600, staleSeconds: 10800 };
  if (pathname === "/odds") return { ttlSeconds: 10800, staleSeconds: 10800 };
  if (pathname === "/odds/live") return { ttlSeconds: 15, staleSeconds: 30 };
  return { ttlSeconds: 900, staleSeconds: 3600 };
}

export function cacheKey(path: string, params: Record<string, string | number | undefined>, mode: string) {
  const sorted = Object.entries(params).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify([mode, path, sorted])).digest("hex");
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function validateCacheRow(row: CacheRow, allowStale: boolean, now = Date.now()): ValidatedCacheResponse | null {
  if (!Array.isArray(row.payload)) return null;
  const expiresAt = validTimestamp(row.expires_at);
  const staleUntil = validTimestamp(row.stale_until);
  const updatedAt = row.updated_at === undefined ? null : validTimestamp(row.updated_at);
  if (expiresAt === null || staleUntil === null || staleUntil < expiresAt || (row.updated_at !== undefined && updatedAt === null)) return null;
  if (allowStale ? staleUntil <= now : expiresAt <= now) return null;
  return {
    response: row.payload,
    stale: expiresAt <= now,
    expiresAt: new Date(expiresAt).toISOString(),
    staleUntil: new Date(staleUntil).toISOString(),
    updatedAt: updatedAt === null ? null : new Date(updatedAt).toISOString(),
  };
}
