import "server-only";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { validateCacheRow, type CacheRow } from "@/lib/football-cache";
import type { FootballPersistenceAdapter } from "@/lib/database/types";

export const supabaseAdapter: FootballPersistenceAdapter = {
  provider: "supabase",
  async readCached(key, allowStale = false) {
    const { data, error } = await getSupabaseServiceRoleClient().from("football_provider_cache").select("payload,expires_at,stale_until,updated_at").eq("cache_key", key).maybeSingle();
    if (error) throw error;
    return data ? validateCacheRow(data as CacheRow, allowStale) : null;
  },
  async acquireCacheLease(key, ownerToken, leaseSeconds) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("acquire_football_cache_lease", { p_cache_key: key, p_owner_token: ownerToken, p_lease_seconds: leaseSeconds });
    if (error) throw error;
    return data === true;
  },
  async writeCachedIfLeaseOwner(input) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("write_football_cache_if_lease_owner", {
      p_cache_key: input.key, p_payload: input.payload, p_expires_at: input.expiresAt,
      p_stale_until: input.staleUntil, p_owner_token: input.ownerToken,
    });
    if (error) throw error;
    return data !== false;
  },
  async releaseCacheLease(key, ownerToken) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("release_football_cache_lease", { p_cache_key: key, p_owner_token: ownerToken });
    if (error) throw error;
    return data !== false;
  },
  async reserveProviderQuota(input) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("reserve_football_api_quota", {
      p_attempt_id: input.attemptId, p_attempted_at: input.attemptedAt, p_quota_scope: input.quotaScope, p_essential: input.essential,
      p_daily_limit: input.limits.dailyLimit, p_reserve: input.limits.reserve,
      p_minute_limit: input.limits.minuteLimit, p_minute_reserve: input.limits.minuteReserve,
    });
    if (error) throw error;
    return data;
  },
  async dispatchProviderAttempt(attemptId, quotaScope) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("dispatch_football_api_attempt", { p_attempt_id: attemptId, p_quota_scope: quotaScope });
    if (error) throw error;
    return data;
  },
  async finaliseProviderAttempt(event) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("record_football_api_attempt", {
      p_attempt_id: event.attemptId, p_attempted_at: event.attemptedAt, p_outcome: event.outcome, p_quota_scope: event.quotaScope,
      p_status: event.status, p_limit: event.providerLimit, p_remaining: event.providerRemaining, p_quota_observed_at: event.quotaObservedAt,
      p_minute_limit: event.providerMinuteLimit, p_minute_remaining: event.providerMinuteRemaining,
    });
    if (error) throw error;
    return data !== false;
  },
  async readDailyUsage(dayUtc) {
    const { data, error } = await getSupabaseServiceRoleClient().from("football_api_usage_daily")
      .select("day,outbound_calls,successful_responses,http_errors,provider_errors,network_errors,timeouts,provider_limit,provider_remaining,provider_minute_limit,provider_minute_remaining,last_call_at")
      .eq("day", dayUtc).maybeSingle();
    if (error) throw error;
    return data;
  },
  async cleanupExpired(limit) {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("cleanup_expired_football_cache_bounded", { p_limit: limit });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { cacheRows: Number(row?.cache_rows_deleted ?? 0), leaseRows: Number(row?.lease_rows_deleted ?? 0) };
  },
  async health() {
    const { error } = await getSupabaseServiceRoleClient().from("football_api_usage_daily").select("day", { head: true, count: "exact" }).limit(1);
    return { ok: !error, provider: "supabase" };
  },
};
