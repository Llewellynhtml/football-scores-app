import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb } from "./lib/mariadb-local-guard.mjs";

const expected = requireIsolatedLocalMariaDb("local validation");
const connection = await mysql.createConnection({ host: expected.host, port: Number(process.env.MYSQL_PORT ?? 3306), database: expected.database, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z", connectTimeout: 5000, dateStrings: true });
try {
  const [identity] = await connection.query("SELECT DATABASE() selected_database, VERSION() version, @@version_comment version_comment");
  assert.equal(identity[0].selected_database, expected.database);
  assert.match(identity[0].version, /^11\.8\./);
  assert.match(identity[0].version_comment, /MariaDB/i);
  await connection.query("SET SESSION time_zone='+00:00'");
  await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
  await connection.query("SET SESSION sql_mode=CONCAT_WS(',',NULLIF(@@SESSION.sql_mode,''),'STRICT_TRANS_TABLES')");
  await connection.query("SET SESSION innodb_strict_mode=ON");
  await connection.query("SET SESSION innodb_lock_wait_timeout=5");
  const [session] = await connection.query("SELECT @@session.time_zone time_zone,@@session.transaction_isolation isolation_level,@@session.sql_mode sql_mode,@@session.innodb_strict_mode strict_mode,@@session.innodb_lock_wait_timeout lock_wait");
  assert.equal(session[0].time_zone, "+00:00");
  assert.match(session[0].isolation_level, /READ-COMMITTED/i);
  assert.match(session[0].sql_mode, /STRICT_TRANS_TABLES/);
  assert.equal(Number(session[0].strict_mode), 1);
  assert.equal(Number(session[0].lock_wait), 5);
  const [tables] = await connection.execute("SELECT TABLE_NAME tableName,ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME");
  const nonInnoDb = tables.filter((table) => table.engine && table.engine !== "InnoDB");
  assert.deepEqual(nonInnoDb, []);
  if (process.env.MARIADB_EXPECT_SCHEMA === "true") {
    const names = new Set(tables.map((table) => table.tableName));
    for (const required of ["schema_migrations", "football_provider_cache", "football_cache_leases", "football_quota_locks", "football_api_usage_daily", "football_api_attempts", "football_maintenance_runs"]) {
      assert.equal(names.has(required), true, `Missing migrated table: ${required}`);
    }
  }
  console.log(JSON.stringify({ ok: true, host: expected.host, database: expected.database, version: identity[0].version, session: session[0], tables }, null, 2));
} finally { await connection.end(); }
