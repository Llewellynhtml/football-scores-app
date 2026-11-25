import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { validateCacheRow, type CacheRow } from "@/lib/football-cache";
import type { DispatchResult, QuotaReservationResult } from "@/lib/football-persistence";
import type { FootballPersistenceAdapter } from "@/lib/database/types";
import { withMysqlConnection, withMysqlTransaction } from "@/lib/database/mysql-transactions";

type AttemptRow = RowDataPacket & {
  quota_scope: string;
  state: string;
  attempted_at: string;
  usage_day: string;
  essential: number;
  reserved_at: string;
  reservation_expires_at: string;
  reserved_daily_limit: number;
  reserved_daily_reserve: number;
  reserved_minute_limit: number;
  reserved_minute_reserve: number;
};

function uuidBytes(uuid: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) throw new Error("Invalid UUID");
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

function mysqlDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.valueOf())) throw new Error("Invalid UTC timestamp");
  return date.toISOString().slice(0, 23).replace("T", " ");
}

function validateLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) throw new Error("Cleanup limit must be between 1 and 5000");
}

async function lockQuotaScope(connection: import("mysql2/promise").PoolConnection, scope: string) {
  await connection.execute("INSERT IGNORE INTO football_quota_locks (quota_scope, touched_at) VALUES (?, UTC_TIMESTAMP(6))", [scope]);
  await connection.execute("SELECT quota_scope FROM football_quota_locks WHERE quota_scope = ? FOR UPDATE", [scope]);
  await connection.execute("UPDATE football_quota_locks SET touched_at = UTC_TIMESTAMP(6) WHERE quota_scope = ?", [scope]);
}

async function currentAttempt(connection: import("mysql2/promise").PoolConnection, attemptId: string) {
  const [rows] = await connection.execute<AttemptRow[]>("SELECT * FROM football_api_attempts WHERE attempt_id = ? FOR UPDATE", [uuidBytes(attemptId)]);
  return rows[0] ?? null;
}

export const mysqlAdapter: FootballPersistenceAdapter = {
  provider: "mysql",
  async readCached(key, allowStale = false) {
    return withMysqlConnection("cache.read", async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & CacheRow)[]>(
        "SELECT payload, expires_at, stale_until, updated_at FROM football_provider_cache WHERE cache_key = ? LIMIT 1", [key],
      );
      if (!rows[0]) return null;
      const payload = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
      return validateCacheRow({ ...rows[0], payload }, allowStale);
    });
  },
  async acquireCacheLease(key, ownerToken, leaseSeconds) {
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 300) throw new Error("Invalid lease duration");
    return withMysqlTransaction("lease.acquire", async (connection) => {
      const owner = uuidBytes(ownerToken);
      await connection.execute(
        `INSERT INTO football_cache_leases (cache_key, owner_token, acquired_at, lease_expires_at)
         VALUES (?, ?, UTC_TIMESTAMP(6), TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP(6)))
         ON DUPLICATE KEY UPDATE
           owner_token = IF(lease_expires_at <= UTC_TIMESTAMP(6), VALUES(owner_token), owner_token),
           acquired_at = IF(lease_expires_at <= UTC_TIMESTAMP(6), VALUES(acquired_at), acquired_at),
           lease_expires_at = IF(lease_expires_at <= UTC_TIMESTAMP(6), VALUES(lease_expires_at), lease_expires_at)`,
        [key, owner, leaseSeconds],
      );
      const [rows] = await connection.execute<(RowDataPacket & { owned: number })[]>(
        "SELECT (owner_token = ? AND lease_expires_at > UTC_TIMESTAMP(6)) AS owned FROM football_cache_leases WHERE cache_key = ? FOR UPDATE", [owner, key],
      );
      return rows[0]?.owned === 1;
    });
  },
  async writeCachedIfLeaseOwner(input) {
    return withMysqlTransaction("cache.write", async (connection) => {
      const owner = uuidBytes(input.ownerToken);
      const [leases] = await connection.execute<(RowDataPacket & { owned: number })[]>(
        "SELECT (owner_token = ? AND lease_expires_at > UTC_TIMESTAMP(6)) AS owned FROM football_cache_leases WHERE cache_key = ? FOR UPDATE", [owner, input.key],
      );
      if (leases[0]?.owned !== 1) return false;
      await connection.execute(
        `INSERT INTO football_provider_cache (cache_key, payload, expires_at, stale_until, updated_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6))
         ON DUPLICATE KEY UPDATE payload=VALUES(payload), expires_at=VALUES(expires_at), stale_until=VALUES(stale_until), updated_at=VALUES(updated_at)`,
        [input.key, JSON.stringify(input.payload), mysqlDate(input.expiresAt), mysqlDate(input.staleUntil)],
      );
      await connection.execute("DELETE FROM football_cache_leases WHERE cache_key = ? AND owner_token = ?", [input.key, owner]);
      return true;
    });
  },
  async releaseCacheLease(key, ownerToken) {
    return withMysqlConnection("lease.release", async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>("DELETE FROM football_cache_leases WHERE cache_key = ? AND owner_token = ?", [key, uuidBytes(ownerToken)]);
      return result.affectedRows === 1;
    });
  },
  async reserveProviderQuota(input): Promise<QuotaReservationResult> {
    if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(input.quotaScope)) return "INVALID_REQUEST";
    const attemptedAt = mysqlDate(input.attemptedAt);
    return withMysqlTransaction("quota.reserve", async (connection) => {
      await lockQuotaScope(connection, input.quotaScope);
      const [clockRows] = await connection.query<(RowDataPacket & { now_utc: string; day_utc: string; in_range: number })[]>(
        "SELECT UTC_TIMESTAMP(6) now_utc, UTC_DATE() day_utc, ABS(TIMESTAMPDIFF(SECOND, ?, UTC_TIMESTAMP(6))) <= 300 AS in_range", [attemptedAt],
      );
      if (clockRows[0]?.in_range !== 1) return "INVALID_REQUEST";
      const existing = await currentAttempt(connection, input.attemptId);
      if (existing) {
        if (existing.state === "RESERVED" && existing.reservation_expires_at > clockRows[0].now_utc) return "ALREADY_RESERVED";
        if (["DISPATCHED", "UNKNOWN_OUTCOME"].includes(existing.state)) return "ALREADY_DISPATCHED";
        if (["FINALISED", "RECONCILED"].includes(existing.state)) return "ALREADY_FINALISED";
        return "INVALID_REQUEST";
      }
      await connection.execute(
        "UPDATE football_api_attempts SET state='CANCELLED', finalised_at=UTC_TIMESTAMP(6) WHERE quota_scope=? AND state='RESERVED' AND reservation_expires_at<=UTC_TIMESTAMP(6) ORDER BY reservation_expires_at LIMIT 100",
        [input.quotaScope],
      );
      await connection.execute(
        "UPDATE football_api_attempts SET state='UNKNOWN_OUTCOME' WHERE quota_scope=? AND state='DISPATCHED' AND dispatched_at<=TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6)) ORDER BY dispatched_at LIMIT 100",
        [input.quotaScope],
      );
      const [snapshots] = await connection.execute<(RowDataPacket & { provider_limit: number | null; provider_remaining: number | null; provider_minute_limit: number | null; provider_minute_remaining: number | null })[]>(
        "SELECT provider_limit, provider_remaining, provider_minute_limit, provider_minute_remaining FROM football_api_usage_daily WHERE quota_scope=? AND day=UTC_DATE()", [input.quotaScope],
      );
      const snapshot = snapshots[0];
      const dailyLimit = Math.min(input.limits.dailyLimit, snapshot?.provider_limit ?? input.limits.dailyLimit);
      const minuteLimit = Math.min(input.limits.minuteLimit, snapshot?.provider_minute_limit ?? input.limits.minuteLimit);
      const dailyReserve = input.essential ? 0 : Math.min(input.limits.reserve, dailyLimit);
      const minuteReserve = input.essential ? 0 : Math.min(input.limits.minuteReserve, minuteLimit);
      if (snapshot?.provider_remaining != null && snapshot.provider_remaining <= dailyReserve) return "DAILY_LIMIT_REACHED";
      if (snapshot?.provider_minute_remaining != null && snapshot.provider_minute_remaining <= minuteReserve) return "MINUTE_LIMIT_REACHED";
      const [counts] = await connection.execute<(RowDataPacket & { daily_count: number; minute_count: number })[]>(
        `SELECT
          SUM(usage_day=UTC_DATE() AND ((state='RESERVED' AND reservation_expires_at>UTC_TIMESTAMP(6)) OR state IN ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED'))) daily_count,
          SUM((state='RESERVED' AND reserved_at>TIMESTAMPADD(MINUTE,-1,UTC_TIMESTAMP(6)) AND reservation_expires_at>UTC_TIMESTAMP(6)) OR
              (state IN ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED') AND dispatched_at>TIMESTAMPADD(MINUTE,-1,UTC_TIMESTAMP(6)))) minute_count
         FROM football_api_attempts WHERE quota_scope=?`, [input.quotaScope],
      );
      if (Number(counts[0]?.daily_count ?? 0) >= dailyLimit - dailyReserve) return "DAILY_LIMIT_REACHED";
      if (Number(counts[0]?.minute_count ?? 0) >= minuteLimit - minuteReserve) return "MINUTE_LIMIT_REACHED";
      await connection.execute(
        `INSERT INTO football_api_attempts
         (attempt_id,quota_scope,attempted_at,usage_day,essential,reserved_daily_limit,reserved_daily_reserve,reserved_minute_limit,reserved_minute_reserve,state,reserved_at,reservation_expires_at)
         VALUES (?,?,?,UTC_DATE(),?,?,?,?,?,'RESERVED',UTC_TIMESTAMP(6),TIMESTAMPADD(MINUTE,2,UTC_TIMESTAMP(6)))`,
        [uuidBytes(input.attemptId), input.quotaScope, attemptedAt, input.essential, dailyLimit, input.limits.reserve, minuteLimit, input.limits.minuteReserve],
      );
      return "ACQUIRED";
    });
  },
  async dispatchProviderAttempt(attemptId, quotaScope): Promise<DispatchResult> {
    return withMysqlTransaction("quota.dispatch", async (connection) => {
      await lockQuotaScope(connection, quotaScope);
      const [clockRows] = await connection.query<(RowDataPacket & { now_utc: string; day_utc: string })[]>("SELECT UTC_TIMESTAMP(6) now_utc, UTC_DATE() day_utc");
      const clock = clockRows[0];
      const attempt = await currentAttempt(connection, attemptId);
      if (!attempt || attempt.quota_scope !== quotaScope) return "INVALID_REQUEST";
      if (attempt.state === "RESERVED" && attempt.reservation_expires_at > clock.now_utc) {
        if (attempt.usage_day !== clock.day_utc) {
          const [rows] = await connection.execute<(RowDataPacket & { amount: number })[]>(
            "SELECT COUNT(*) amount FROM football_api_attempts WHERE quota_scope=? AND usage_day=UTC_DATE() AND ((state='RESERVED' AND reservation_expires_at>UTC_TIMESTAMP(6)) OR state IN ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED'))", [quotaScope],
          );
          const reserve = attempt.essential ? 0 : Math.min(attempt.reserved_daily_reserve, attempt.reserved_daily_limit);
          if (rows[0].amount >= attempt.reserved_daily_limit - reserve) {
            await connection.execute("UPDATE football_api_attempts SET state='CANCELLED',finalised_at=UTC_TIMESTAMP(6) WHERE attempt_id=?", [uuidBytes(attemptId)]);
            return "DAILY_LIMIT_REACHED";
          }
        }
        const [minuteRows] = await connection.execute<(RowDataPacket & { aged: number; amount: number })[]>(
          `SELECT TIMESTAMPDIFF(SECOND, ?, UTC_TIMESTAMP(6))>=60 aged,
           (SELECT COUNT(*) FROM football_api_attempts WHERE quota_scope=? AND state IN ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED') AND dispatched_at>TIMESTAMPADD(MINUTE,-1,UTC_TIMESTAMP(6))) amount`,
          [attempt.reserved_at, quotaScope],
        );
        const minuteReserve = attempt.essential ? 0 : Math.min(attempt.reserved_minute_reserve, attempt.reserved_minute_limit);
        if (minuteRows[0].aged === 1 && minuteRows[0].amount >= attempt.reserved_minute_limit - minuteReserve) {
          await connection.execute("UPDATE football_api_attempts SET state='CANCELLED',finalised_at=UTC_TIMESTAMP(6) WHERE attempt_id=?", [uuidBytes(attemptId)]);
          return "MINUTE_LIMIT_REACHED";
        }
        await connection.execute("UPDATE football_api_attempts SET state='DISPATCHED',dispatched_at=UTC_TIMESTAMP(6),usage_day=UTC_DATE() WHERE attempt_id=?", [uuidBytes(attemptId)]);
        return "DISPATCHED";
      }
      if (attempt.state === "RESERVED") {
        await connection.execute("UPDATE football_api_attempts SET state='CANCELLED',finalised_at=UTC_TIMESTAMP(6) WHERE attempt_id=?", [uuidBytes(attemptId)]);
        return "RESERVATION_EXPIRED";
      }
      if (["DISPATCHED", "UNKNOWN_OUTCOME"].includes(attempt.state)) return "ALREADY_DISPATCHED";
      if (["FINALISED", "RECONCILED"].includes(attempt.state)) return "ALREADY_FINALISED";
      return "INVALID_REQUEST";
    });
  },
  async finaliseProviderAttempt(event) {
    return withMysqlTransaction("quota.finalise", async (connection) => {
      await lockQuotaScope(connection, event.quotaScope);
      const attempt = await currentAttempt(connection, event.attemptId);
      if (!attempt || attempt.quota_scope !== event.quotaScope || !["DISPATCHED", "UNKNOWN_OUTCOME"].includes(attempt.state)) return false;
      if (mysqlDate(event.attemptedAt) !== attempt.attempted_at) return false;
      await connection.execute(
        `UPDATE football_api_attempts SET state='FINALISED',finalised_at=UTC_TIMESTAMP(6),outcome=?,http_status=?,provider_limit=?,provider_remaining=?,provider_minute_limit=?,provider_minute_remaining=?,quota_observed_at=? WHERE attempt_id=?`,
        [event.outcome,event.status,event.providerLimit,event.providerRemaining,event.providerMinuteLimit,event.providerMinuteRemaining,event.quotaObservedAt ? mysqlDate(event.quotaObservedAt) : null,uuidBytes(event.attemptId)],
      );
      await connection.execute(
        `INSERT INTO football_api_usage_daily
         (quota_scope,day,outbound_calls,failed_calls,successful_responses,http_errors,provider_errors,network_errors,timeouts,provider_limit,provider_remaining,provider_minute_limit,provider_minute_remaining,last_call_at,quota_observed_at)
         VALUES (?,?,1,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE outbound_calls=outbound_calls+1,failed_calls=failed_calls+VALUES(failed_calls),successful_responses=successful_responses+VALUES(successful_responses),
         http_errors=http_errors+VALUES(http_errors),provider_errors=provider_errors+VALUES(provider_errors),network_errors=network_errors+VALUES(network_errors),timeouts=timeouts+VALUES(timeouts),
         provider_limit=IF(VALUES(quota_observed_at) IS NOT NULL AND (quota_observed_at IS NULL OR VALUES(quota_observed_at)>=quota_observed_at),COALESCE(VALUES(provider_limit),provider_limit),provider_limit),
         provider_remaining=IF(VALUES(quota_observed_at) IS NOT NULL AND (quota_observed_at IS NULL OR VALUES(quota_observed_at)>=quota_observed_at),COALESCE(VALUES(provider_remaining),provider_remaining),provider_remaining),
         provider_minute_limit=IF(VALUES(quota_observed_at) IS NOT NULL AND (quota_observed_at IS NULL OR VALUES(quota_observed_at)>=quota_observed_at),COALESCE(VALUES(provider_minute_limit),provider_minute_limit),provider_minute_limit),
         provider_minute_remaining=IF(VALUES(quota_observed_at) IS NOT NULL AND (quota_observed_at IS NULL OR VALUES(quota_observed_at)>=quota_observed_at),COALESCE(VALUES(provider_minute_remaining),provider_minute_remaining),provider_minute_remaining),
         quota_observed_at=IF(VALUES(quota_observed_at) IS NULL,quota_observed_at,GREATEST(COALESCE(quota_observed_at,VALUES(quota_observed_at)),VALUES(quota_observed_at))),last_call_at=GREATEST(last_call_at,VALUES(last_call_at))`,
        [event.quotaScope,attempt.usage_day,event.outcome === "success" ? 0 : 1,event.outcome === "success" ? 1 : 0,event.outcome === "http_error" ? 1 : 0,event.outcome === "provider_error" ? 1 : 0,event.outcome === "network_error" ? 1 : 0,event.outcome === "timeout" ? 1 : 0,event.providerLimit,event.providerRemaining,event.providerMinuteLimit,event.providerMinuteRemaining,attempt.attempted_at,event.quotaObservedAt ? mysqlDate(event.quotaObservedAt) : null],
      );
      return true;
    });
  },
  async readDailyUsage(dayUtc, quotaScope) {
    return withMysqlConnection("usage.read", async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT day,outbound_calls,successful_responses,http_errors,provider_errors,network_errors,timeouts,provider_limit,provider_remaining,provider_minute_limit,provider_minute_remaining,last_call_at FROM football_api_usage_daily WHERE quota_scope=? AND day=? LIMIT 1",
        [quotaScope, dayUtc],
      );
      return rows[0] ?? null;
    });
  },
  async cleanupExpired(limit) {
    validateLimit(limit);
    return withMysqlTransaction("maintenance.cleanup", async (connection) => {
      const [cache] = await connection.execute<ResultSetHeader>("DELETE FROM football_provider_cache WHERE stale_until<=UTC_TIMESTAMP(6) ORDER BY stale_until LIMIT ?", [limit]);
      const [leases] = await connection.execute<ResultSetHeader>("DELETE FROM football_cache_leases WHERE lease_expires_at<=UTC_TIMESTAMP(6) ORDER BY lease_expires_at LIMIT ?", [limit]);
      return { cacheRows: cache.affectedRows, leaseRows: leases.affectedRows };
    });
  },
  async health() {
    try {
      await withMysqlConnection("health", async (connection) => { await connection.query("SELECT 1"); });
      return { ok: true, provider: "mysql" };
    } catch {
      return { ok: false, provider: "mysql" };
    }
  },
};
