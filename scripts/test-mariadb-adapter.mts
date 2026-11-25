import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { mysqlAdapter } from "../src/lib/database/mysql-adapter.ts";
import { requireIsolatedLocalMariaDb, requireLoopbackMockProvider } from "./lib/mariadb-local-guard.mjs";

requireIsolatedLocalMariaDb("adapter contract tests");
requireLoopbackMockProvider("adapter contract tests");
const prefix = `m3-${randomUUID()}`;
const cacheKey = `${prefix}-cache`;
const oldOwner = randomUUID();
const newOwner = randomUUID();
const scope = `${prefix}-quota`;
const attemptedAt = new Date().toISOString();
const attempts = [randomUUID(), randomUUID()];
const auxiliaryScopes: string[] = [];
const connection = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z" });
try {
  assert.equal(await mysqlAdapter.acquireCacheLease(cacheKey, oldOwner, 5), true);
  await connection.execute("UPDATE football_cache_leases SET lease_expires_at=TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP(6)) WHERE cache_key=?", [cacheKey]);
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

  const limits = { dailyLimit: 1, reserve: 0, minuteLimit: 1, minuteReserve: 0 };
  const reservations = await Promise.all(attempts.map((attemptId) => mysqlAdapter.reserveProviderQuota({ attemptId, attemptedAt, quotaScope: scope, essential: true, limits })));
  assert.equal(reservations.filter((value) => value === "ACQUIRED").length, 1);
  assert.equal(reservations.filter((value) => value === "DAILY_LIMIT_REACHED").length, 1);
  const acquired = attempts[reservations.indexOf("ACQUIRED")];
  assert.equal(await mysqlAdapter.dispatchProviderAttempt(acquired, scope), "DISPATCHED");
  assert.equal(await mysqlAdapter.dispatchProviderAttempt(acquired, scope), "ALREADY_DISPATCHED");
  const event = { attemptId: acquired, quotaScope: scope, attemptedAt, outcome: "success" as const, status: 200, providerLimit: 100, providerRemaining: 99, providerMinuteLimit: 10, providerMinuteRemaining: 9, quotaObservedAt: new Date().toISOString() };
  assert.equal(await mysqlAdapter.finaliseProviderAttempt(event), true);
  assert.equal(await mysqlAdapter.finaliseProviderAttempt(event), false);
  const usage = await mysqlAdapter.readDailyUsage(new Date().toISOString().slice(0, 10), scope);
  assert.equal(Number(usage?.outbound_calls), 1);

  const unknownScope = `${prefix}-unknown`;
  auxiliaryScopes.push(unknownScope);
  const unknownAttempt = randomUUID();
  const cleanupTrigger = randomUUID();
  const generous = { dailyLimit: 100, reserve: 0, minuteLimit: 100, minuteReserve: 0 };
  assert.equal(await mysqlAdapter.reserveProviderQuota({ attemptId: unknownAttempt, attemptedAt: new Date().toISOString(), quotaScope: unknownScope, essential: true, limits: generous }), "ACQUIRED");
  assert.equal(await mysqlAdapter.dispatchProviderAttempt(unknownAttempt, unknownScope), "DISPATCHED");
  await connection.execute("UPDATE football_api_attempts SET dispatched_at=TIMESTAMPADD(MINUTE,-3,UTC_TIMESTAMP(6)) WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [unknownAttempt]);
  assert.equal(await mysqlAdapter.reserveProviderQuota({ attemptId: cleanupTrigger, attemptedAt: new Date().toISOString(), quotaScope: unknownScope, essential: true, limits: generous }), "ACQUIRED");
  const [[unknownRow]] = await connection.execute<(RowDataPacket & { state: string })[]>("SELECT state FROM football_api_attempts WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [unknownAttempt]);
  assert.equal(unknownRow.state, "UNKNOWN_OUTCOME");

  const rolloverScope = `${prefix}-rollover`;
  auxiliaryScopes.push(rolloverScope);
  const rolloverAttempt = randomUUID();
  assert.equal(await mysqlAdapter.reserveProviderQuota({ attemptId: rolloverAttempt, attemptedAt: new Date().toISOString(), quotaScope: rolloverScope, essential: true, limits: generous }), "ACQUIRED");
  await connection.execute("UPDATE football_api_attempts SET usage_day=UTC_DATE()-INTERVAL 1 DAY,reserved_at=TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6)) WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [rolloverAttempt]);
  assert.equal(await mysqlAdapter.dispatchProviderAttempt(rolloverAttempt, rolloverScope), "DISPATCHED");
  const [[rolloverRow]] = await connection.execute<(RowDataPacket & { current_day: number })[]>("SELECT usage_day=UTC_DATE() current_day FROM football_api_attempts WHERE attempt_id=UNHEX(REPLACE(?, '-', ''))", [rolloverAttempt]);
  assert.equal(Number(rolloverRow.current_day), 1);
  console.log("MariaDB adapter lease fencing, atomic quota, duplicate dispatch and idempotent finalisation passed");
} finally {
  await connection.execute("DELETE FROM football_provider_cache WHERE cache_key=?", [cacheKey]).catch(() => undefined);
  await connection.execute("DELETE FROM football_cache_leases WHERE cache_key=?", [cacheKey]).catch(() => undefined);
  await connection.execute("DELETE FROM football_provider_cache WHERE cache_key=?", [`${prefix}-rollback`]).catch(() => undefined);
  await connection.execute("DELETE FROM football_cache_leases WHERE cache_key=?", [`${prefix}-rollback`]).catch(() => undefined);
  await connection.execute("DELETE FROM football_api_attempts WHERE quota_scope=?", [scope]).catch(() => undefined);
  await connection.execute("DELETE FROM football_api_usage_daily WHERE quota_scope=?", [scope]).catch(() => undefined);
  await connection.execute("DELETE FROM football_quota_locks WHERE quota_scope=?", [scope]).catch(() => undefined);
  for (const auxiliaryScope of auxiliaryScopes) {
    await connection.execute("DELETE FROM football_api_attempts WHERE quota_scope=?", [auxiliaryScope]).catch(() => undefined);
    await connection.execute("DELETE FROM football_api_usage_daily WHERE quota_scope=?", [auxiliaryScope]).catch(() => undefined);
    await connection.execute("DELETE FROM football_quota_locks WHERE quota_scope=?", [auxiliaryScope]).catch(() => undefined);
  }
  await connection.end();
}
