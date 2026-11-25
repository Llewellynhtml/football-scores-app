import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb, requireLoopbackMockProvider } from "./lib/mariadb-local-guard.mjs";

requireIsolatedLocalMariaDb("integration tests");
requireLoopbackMockProvider("integration tests");
const pool = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, connectionLimit: 5, maxIdle: 2, idleTimeout: 10_000, queueLimit: 50, waitForConnections: true, timezone: "Z", enableKeepAlive: true });
const key = `m1-${randomUUID()}`;
const owner1 = Buffer.from(randomUUID().replaceAll("-", ""), "hex");
const owner2 = Buffer.from(randomUUID().replaceAll("-", ""), "hex");
try {
  const connection = await pool.getConnection();
  await connection.query("SET SESSION time_zone='+00:00'");
  await connection.query("SET SESSION sql_mode=CONCAT_WS(',',NULLIF(@@SESSION.sql_mode,''),'STRICT_TRANS_TABLES')");
  const [session] = await connection.query("SELECT @@session.time_zone tz,@@session.transaction_isolation isolation_level,@@session.sql_mode sql_mode");
  assert.equal(session[0].tz, "+00:00");
  assert.match(session[0].isolation_level, /READ-COMMITTED/i);
  assert.match(session[0].sql_mode, /STRICT_TRANS_TABLES/);
  await connection.beginTransaction();
  await connection.execute("INSERT INTO football_quota_locks(quota_scope,touched_at) VALUES(?,UTC_TIMESTAMP(6))", [key]);
  await connection.rollback();
  const [rolledBack] = await connection.execute("SELECT COUNT(*) amount FROM football_quota_locks WHERE quota_scope=?", [key]);
  assert.equal(rolledBack[0].amount, 0);
  connection.release();

  const acquire = async (owner) => {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      await c.execute(`INSERT INTO football_cache_leases(cache_key,owner_token,acquired_at,lease_expires_at) VALUES(?,?,UTC_TIMESTAMP(6),TIMESTAMPADD(SECOND,5,UTC_TIMESTAMP(6))) ON DUPLICATE KEY UPDATE owner_token=IF(lease_expires_at<=UTC_TIMESTAMP(6),VALUES(owner_token),owner_token),acquired_at=IF(lease_expires_at<=UTC_TIMESTAMP(6),VALUES(acquired_at),acquired_at),lease_expires_at=IF(lease_expires_at<=UTC_TIMESTAMP(6),VALUES(lease_expires_at),lease_expires_at)`, [key, owner]);
      const [rows] = await c.execute("SELECT owner_token=? owned FROM football_cache_leases WHERE cache_key=? FOR UPDATE", [owner, key]);
      await c.commit();
      return rows[0].owned;
    } finally { c.release(); }
  };
  const results = await Promise.all([acquire(owner1), acquire(owner2)]);
  assert.equal(results.filter(Boolean).length, 1);

  const idle = await pool.getConnection();
  await idle.query("SELECT 1");
  idle.release();
  await new Promise((resolve) => setTimeout(resolve, 21_000));
  const [afterIdle] = await pool.query("SELECT 1 ok");
  assert.equal(afterIdle[0].ok, 1);
  console.log("MariaDB isolated session, rollback, concurrent lease and idle reconnect checks passed");
} finally {
  await pool.execute("DELETE FROM football_cache_leases WHERE cache_key=?", [key]).catch(() => undefined);
  await pool.execute("DELETE FROM football_quota_locks WHERE quota_scope=?", [key]).catch(() => undefined);
  await pool.end();
}
