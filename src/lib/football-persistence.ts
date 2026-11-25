import "server-only";
import type { ProviderAttemptOutcome } from "@/lib/api-usage";
import type { UsageEvent } from "@/lib/usage-queue";
import { cacheKey, validateCacheRow, type CacheRow, type ValidatedCacheResponse } from "@/lib/football-cache";
import { getFootballPersistenceAdapter, persistentDatabaseConfigured } from "@/lib/database";

export type CachedResponse = ValidatedCacheResponse;
export { cacheKey, validateCacheRow };

export type QuotaReservationResult = "ACQUIRED" | "ALREADY_RESERVED" | "ALREADY_DISPATCHED" | "ALREADY_FINALISED" | "DAILY_LIMIT_REACHED" | "MINUTE_LIMIT_REACHED" | "INVALID_REQUEST" | "DEGRADED";
export type DispatchResult = "DISPATCHED" | "ALREADY_DISPATCHED" | "ALREADY_FINALISED" | "RESERVATION_EXPIRED" | "DAILY_LIMIT_REACHED" | "MINUTE_LIMIT_REACHED" | "INVALID_REQUEST";

export function footballQuotaScope() {
  const value = (process.env.FOOTBALL_QUOTA_SCOPE ?? "api-football-default").trim();
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(value)) throw new Error("FOOTBALL_QUOTA_SCOPE is invalid");
  return value;
}

export function persistentStoreConfigured() {
  return persistentDatabaseConfigured();
}

export function persistenceEnabled() {
  return process.env.FOOTBALL_PERSISTENCE_ENABLED?.trim().toLowerCase() === "true" && persistentStoreConfigured();
}

function db() {
  return persistenceEnabled() ? getFootballPersistenceAdapter() : null;
}

export async function readCached(key: string, allowStale = false): Promise<CachedResponse | null> {
  const client = db();
  if (!client) return null;
  return client.readCached(key, allowStale);
}

export async function writeCached(key: string, payload: unknown[], ttlSeconds: number, staleSeconds: number, ownerToken?: string) {
  const client = db();
  if (!client) return;
  if (!Array.isArray(payload) || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || !Number.isFinite(staleSeconds) || staleSeconds < 0) {
    throw new Error("Invalid football cache payload or TTL");
  }
  if (!ownerToken) return;
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  await client.writeCachedIfLeaseOwner({
    key, payload, expiresAt: new Date(expiresAt).toISOString(),
    staleUntil: new Date(expiresAt + staleSeconds * 1000).toISOString(), ownerToken,
  });
}

export async function acquireCacheLease(key: string, ownerToken: string, leaseSeconds: number) {
  const client = db();
  if (!client) return false;
  return client.acquireCacheLease(key, ownerToken, leaseSeconds);
}

export async function releaseCacheLease(key: string, ownerToken: string) {
  const client = db();
  if (!client) return;
  await client.releaseCacheLease(key, ownerToken);
}

export async function reserveProviderQuota(attemptId: string, attemptedAt: string, essential: boolean, limits?: { dailyLimit: number; reserve: number; minuteLimit: number; minuteReserve: number }): Promise<QuotaReservationResult> {
  const client = db();
  if (!client) return "DEGRADED";
  return client.reserveProviderQuota({
    attemptId, attemptedAt, quotaScope: footballQuotaScope(), essential,
    limits: {
      dailyLimit: limits?.dailyLimit ?? Number(process.env.FOOTBALL_DAILY_REQUEST_LIMIT ?? 100),
      reserve: limits?.reserve ?? Number(process.env.FOOTBALL_QUOTA_RESERVE ?? 10),
      minuteLimit: limits?.minuteLimit ?? Number(process.env.FOOTBALL_PER_MINUTE_REQUEST_LIMIT ?? 10),
      minuteReserve: limits?.minuteReserve ?? Number(process.env.FOOTBALL_PER_MINUTE_RESERVE ?? 2),
    },
  });
}

export async function markProviderAttemptDispatched(attemptId: string): Promise<DispatchResult> {
  const client = db();
  if (!client) return "INVALID_REQUEST";
  return client.dispatchProviderAttempt(attemptId, footballQuotaScope());
}

export async function persistUsageEvent(event: UsageEvent) {
  const client = db();
  if (!client) return;
  await client.finaliseProviderAttempt(event);
}

export async function recordDurableUsage(outcome: ProviderAttemptOutcome, status: number | null, headers: Headers | undefined, attemptId: string, attemptedAt: string) {
  const numberHeader = (name: string) => {
    const value = headers?.get(name);
    return value != null && /^\d+$/.test(value) ? Number(value) : null;
  };
  return persistUsageEvent({ attemptId, quotaScope: footballQuotaScope(), attemptedAt, outcome, status, providerLimit: numberHeader("x-ratelimit-requests-limit"), providerRemaining: numberHeader("x-ratelimit-requests-remaining"), providerMinuteLimit: numberHeader("x-ratelimit-limit"), providerMinuteRemaining: numberHeader("x-ratelimit-remaining"), quotaObservedAt: headers ? new Date().toISOString() : null });
}

export async function readDurableUsage() {
  const client = db();
  if (!client) return null;
  const date = new Date().toISOString().slice(0, 10);
  return client.readDailyUsage(date, footballQuotaScope());
}
