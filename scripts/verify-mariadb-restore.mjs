import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb } from "./lib/mariadb-local-guard.mjs";

const source = requireIsolatedLocalMariaDb("backup verification");
const target = process.env.MARIADB_RESTORE_DATABASE;
if (!target || !/^football_scores_test_restore_[a-z0-9_]+$/i.test(target)) throw new Error("MARIADB_RESTORE_DATABASE must be a dedicated football_scores_test_restore_* database");
const options = { host: source.host, port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z" };
const sourceDb = await mysql.createConnection({ ...options, database: source.database });
const restoredDb = await mysql.createConnection({ ...options, database: target });
try {
  const [tables] = await sourceDb.execute("SELECT TABLE_NAME tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME");
  const results = [];
  for (const { tableName } of tables) {
    if (!/^[a-z0-9_]+$/i.test(tableName)) throw new Error("Unsafe table name returned by catalogue");
    const [[sourceCount]] = await sourceDb.query(`SELECT COUNT(*) amount FROM \`${tableName}\``);
    const [[restoredCount]] = await restoredDb.query(`SELECT COUNT(*) amount FROM \`${tableName}\``);
    assert.equal(Number(restoredCount.amount), Number(sourceCount.amount), `Row count differs for ${tableName}`);
    results.push({ tableName, rows: Number(sourceCount.amount) });
  }
  const [[sourceCache]] = await sourceDb.query("SELECT COUNT(*) amount,COALESCE(SHA2(GROUP_CONCAT(SHA2(payload,256) ORDER BY cache_key SEPARATOR ''),256),'empty') digest FROM football_provider_cache");
  const [[restoredCache]] = await restoredDb.query("SELECT COUNT(*) amount,COALESCE(SHA2(GROUP_CONCAT(SHA2(payload,256) ORDER BY cache_key SEPARATOR ''),256),'empty') digest FROM football_provider_cache");
  assert.deepEqual(restoredCache, sourceCache);
  console.log(JSON.stringify({ ok: true, source: source.database, restored: target, tables: results, representativeCache: sourceCache }, null, 2));
} finally { await sourceDb.end(); await restoredDb.end(); }
