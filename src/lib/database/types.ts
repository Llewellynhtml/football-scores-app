import type { UsageEvent } from "@/lib/usage-queue";
import type { CachedResponse, DispatchResult, QuotaReservationResult } from "@/lib/football-persistence";

export type DatabaseProvider = "supabase" | "mysql";

export type QuotaLimits = {
  dailyLimit: number;
  reserve: number;
  minuteLimit: number;
  minuteReserve: number;
};

export type CacheWrite = {
  key: string;
  payload: unknown[];
  expiresAt: string;
  staleUntil: string;
  ownerToken: string;
};

export interface FootballPersistenceAdapter {
  readonly provider: DatabaseProvider;
  readCached(key: string, allowStale?: boolean): Promise<CachedResponse | null>;
  acquireCacheLease(key: string, ownerToken: string, leaseSeconds: number): Promise<boolean>;
  writeCachedIfLeaseOwner(input: CacheWrite): Promise<boolean>;
  releaseCacheLease(key: string, ownerToken: string): Promise<boolean>;
  reserveProviderQuota(input: {
    attemptId: string;
    attemptedAt: string;
    quotaScope: string;
    essential: boolean;
    limits: QuotaLimits;
  }): Promise<QuotaReservationResult>;
  dispatchProviderAttempt(attemptId: string, quotaScope: string): Promise<DispatchResult>;
  finaliseProviderAttempt(event: UsageEvent): Promise<boolean>;
  readDailyUsage(dayUtc: string, quotaScope: string): Promise<Record<string, unknown> | null>;
  cleanupExpired(limit: number): Promise<{ cacheRows: number; leaseRows: number }>;
  health(): Promise<{ ok: boolean; provider: DatabaseProvider }>;
}
