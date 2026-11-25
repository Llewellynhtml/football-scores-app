import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { mysqlAdapter } from "../src/lib/database/mysql-adapter.ts";
import { getMysqlPool } from "../src/lib/database/mysql-pool.ts";
import { requireIsolatedLocalMariaDb, requireLoopbackMockProvider } from "./lib/mariadb-local-guard.mjs";

requireIsolatedLocalMariaDb("adapter contract tests");
requireLoopbackMockProvider("adapter contract tests");
const prefix = `m3-${randomUUID()}`;
const cacheKey = `${prefix}-cache`;
const oldOwner = randomUUID();
const newOwner = randomUUID();
const auxiliaryScopes: string[] = [];
const connection = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z", connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS ?? 5_000) });
try {
  assert.equal(await mysqlAdapter.acquireCacheLease(cacheKey, oldOwner, 5), true);
  await connection.execute("UPDATE football_cache_leases SET acquired_at=TIMESTAMPADD(SECOND,-2,UTC_TIMESTAMP(6)),lease_expires_at=TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP(6)) WHERE cache_key=?", [cacheKey]);
  const [[expiredLease]] = await connection.execute<(RowDataPacket & { ordered: number; expired: number; previous_owner: number })[]>(
    "SELECT acquired_at<lease_expires_at ordered,lease_expires_at<UTC_TIMESTAMP(6) expired,owner_token=UNHEX(REPLACE(?,'-','')) previous_owner FROM football_cache_leases WHERE cache_key=?",
    [oldOwner, cacheKey],
  );
  assert.equal(Number(expiredLease.ordered), 1);
  assert.equal(Number(expiredLease.expired), 1);
  assert.equal(Number(expiredLease.previous_owner), 1);
  assert.equal(await mysqlAdapter.acquireCacheLease(cacheKey, newOwner, 20), true);
  assert.equal(await mysqlAdapter.writeCachedIfLeaseOwner({ key: cacheKey, payload: [{ owner: "obsolete" }], expiresAt: new Date(Date.now() + 60_000).toISOString(), staleUntil: new Date(Date.now() + 120_000).toISOString(), ownerToken: oldOwner }), false);
  assert.equal(await mysqlAdapter.writeCachedIfLeaseOwner({ key: cacheKey, payload: [{ owner: "current" }], expiresAt: new Date(Date.now() + 60_000).toISOString(), staleUntil: new Date(Date.now() + 120_000).toISOString(), ownerToken: newOwner }), true);
  assert.deepEqual((await mysqlAdapter.readCached(cacheKey))?.response, [{ owner: "current" }]);

  const rollbackKey = `${prefix}-rollback`;
  const rollbackOwner = randomUUID();
  assert.equal(await mysqlAdapter.acquireCacheLease(rollbackKey, rollbackOwner, 20), true);
  const circular: unknown[] = [];
  circular.push(circular);
  await assert.rejects(mysqlAdapter.writeCachedIfLeaseOwner({ key: rollbackKey, payload: circular, expiresAt: new Date(Date.now() + 60_000).toISOString(), staleUntil: new Date(Date.now() + 120_000).toISOString(), ownerToken: rollbackOwner }));
  const [[rollbackCount]] = await connection.execute<(RowDataPacket & { amount: number })[]>("SELECT COUNT(*) amount FROM football_provider_cache WHERE cache_key=?", [rollbackKey]);
  assert.equal(Number(rollbackCount.amount), 0);
  assert.equal(await mysqlAdapter.releaseCacheLease(rollbackKey, rollbackOwner), true);
  assert.equal((await mysqlAdapter.health()).ok, true);

  async function verifyQuotaLimit(quotaScope: string, limits: { dailyLimit: number; reserve: number; minuteLimit: number; minuteReserve: number }, rejectedAs: "DAILY_LIMIT_REACHED" | "MINUTE_LIMIT_REACHED") {
    auxiliaryScopes.push(quotaScope);
    const attemptedAt = new Date().toISOString();
    const attempts = [randomUUID(), randomUUID()];
    const reservations = await Promise.all(attempts.map((attemptId) => mysqlAdapter.reserveProviderQuota({ attemptId, attemptedAt, quotaScope, essential: true, limits })));
    assert.equal(reservations.filter((value) => value === "ACQUIRED").length, 1);
    assert.equal(reservations.filter((value) => value === rejectedAs).length, 1);
    const acquired = attempts[reservations.indexOf("ACQUIRED")];
    assert.equal(await mysqlAdapter.dispatchProviderAttempt(acquired, quotaScope), "DISPATCHED");
    assert.equal(await mysqlAdapter.dispatchProviderAttempt(acquired, quotaScope), "ALREADY_DISPATCHED");
    const event = { attemptId: acquired, quotaScope, attemptedAt, outcome: "success" as const, status: 200, providerLimit: 100, providerRemaining: 99, providerMinuteLimit: 100, providerMinuteRemaining: 99, quotaObservedAt: new Date().toISOString() };
    assert.equal(await mysqlAdapter.finaliseProviderAttempt(event), true);
    assert.equal(await mysqlAdapter.finaliseProviderAttempt(event), false);
    const usage = await mysqlAdapter.readDailyUsage(new Date().toISOString().slice(0, 10), quotaScope);
    assert.equal(Number(usage?.outbound_calls), 1);
  }

  await verifyQuotaLimit(`${prefix}-daily`, { dailyLimit: 1, reserve: 0, minuteLimit: 100, minuteReserve: 0 }, "DAILY_LIMIT_REACHED");
  await verifyQuotaLimit(`${prefix}-minute`, { dailyLimit: 100, reserve: 0, minuteLimit: 1, minuteReserve: 0 }, "MINUTE_LIMIT_REACHED");

  const unknownScope = `${prefix}-unknown`;
  auxiliaryScopes.push(unknownScope);
  const unknownAttempt = randomUUID();
  const cleanupTrigger = randomUUID();
  const generous = { dailyLimit: 100, reserve: 0, minuteLimit: 100, minuteReserve: 0 };
  assert.equal(await mysqlAdapter.reserveProviderQuota({ attemptId: unknownAttempt, attemptedAt: new Date().toISOString(), quotaScope: unknownScope, essential: true, limits: generous }), "ACQUIRED");
  assert.equal(await mysqlAdapter.dispatchProviderAttempt(unknownAttempt, unknownScope), "DISPATCHED");
  await connection.execute("UPDATE football_api_attempts SET attempted_at=TIMESTAMPADD(MINUTE,-4,UTC_TIMESTAMP(6)),reserved_at=TIMESTAMPADD(MINUTE,-4,UTC_TIMESTAMP(6)),reservation_expires_at=TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6)),dispatched_at=TIMESTAMPADD(MINUTE,-3,UTC_TIMESTAMP(6)) WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [unknownAttempt]);
  const [[agedAttempt]] = await connection.execute<(RowDataPacket & { lifecycle_ordered: number; dispatch_aged: number })[]>("SELECT attempted_at<=reserved_at AND reserved_at<dispatched_at AND dispatched_at<reservation_expires_at lifecycle_ordered,dispatched_at<=TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6)) dispatch_aged FROM football_api_attempts WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [unknownAttempt]);
  assert.equal(Number(agedAttempt.lifecycle_ordered), 1);
  assert.equal(Number(agedAttempt.dispatch_aged), 1);
  assert.equal(await mysqlAdapter.reserveProviderQuota({ attemptId: cleanupTrigger, attemptedAt: new Date().toISOString(), quotaScope: unknownScope, essential: true, limits: generous }), "ACQUIRED");
  const [[unknownRow]] = await connection.execute<(RowDataPacket & { state: string })[]>("SELECT state FROM football_api_attempts WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [unknownAttempt]);
  assert.equal(unknownRow.state, "UNKNOWN_OUTCOME");

  const rolloverScope = `${prefix}-rollover`;
  auxiliaryScopes.push(rolloverScope);
  const rolloverAttempt = randomUUID();
  assert.equal(await mysqlAdapter.reserveProviderQuota({ attemptId: rolloverAttempt, attemptedAt: new Date().toISOString(), quotaScope: rolloverScope, essential: true, limits: generous }), "ACQUIRED");
  await connection.execute("UPDATE football_api_attempts SET usage_day=UTC_DATE()-INTERVAL 1 DAY,attempted_at=TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6)),reserved_at=TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6)),reservation_expires_at=TIMESTAMPADD(MINUTE,1,UTC_TIMESTAMP(6)) WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [rolloverAttempt]);
  const [[rolloverFixture]] = await connection.execute<(RowDataPacket & { lifecycle_ordered: number; reservation_active: number; previous_day: number })[]>("SELECT attempted_at<=reserved_at AND reserved_at<reservation_expires_at lifecycle_ordered,reservation_expires_at>UTC_TIMESTAMP(6) reservation_active,usage_day=UTC_DATE()-INTERVAL 1 DAY previous_day FROM football_api_attempts WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [rolloverAttempt]);
  assert.equal(Number(rolloverFixture.lifecycle_ordered), 1);
  assert.equal(Number(rolloverFixture.reservation_active), 1);
  assert.equal(Number(rolloverFixture.previous_day), 1);
  assert.equal(await mysqlAdapter.dispatchProviderAttempt(rolloverAttempt, rolloverScope), "DISPATCHED");
  const [[rolloverRow]] = await connection.execute<(RowDataPacket & { current_day: number })[]>("SELECT usage_day=UTC_DATE() current_day FROM football_api_attempts WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [rolloverAttempt]);
  assert.equal(Number(rolloverRow.current_day), 1);
  console.log("MariaDB adapter lease fencing, atomic quota, duplicate dispatch and idempotent finalisation passed");
} finally {
  await connection.execute("DELETE FROM football_provider_cache WHERE cache_key=?", [cacheKey]).catch(() => undefined);
  await connection.execute("DELETE FROM football_cache_leases WHERE cache_key=?", [cacheKey]).catch(() => undefined);
  await connection.execute("DELETE FROM football_provider_cache WHERE cache_key=?", [`${prefix}-rollback`]).catch(() => undefined);
  await connection.execute("DELETE FROM football_cache_leases WHERE cache_key=?", [`${prefix}-rollback`]).catch(() => undefined);
  for (const auxiliaryScope of auxiliaryScopes) {
    await connection.execute("DELETE FROM football_api_attempts WHERE quota_scope=?", [auxiliaryScope]).catch(() => undefined);
    await connection.execute("DELETE FROM football_api_usage_daily WHERE quota_scope=?", [auxiliaryScope]).catch(() => undefined);
    await connection.execute("DELETE FROM football_quota_locks WHERE quota_scope=?", [auxiliaryScope]).catch(() => undefined);
  }
  await connection.end().catch(() => undefined);
  await getMysqlPool().end().catch(() => undefined);
}
