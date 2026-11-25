import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb } from "./lib/mariadb-local-guard.mjs";

if (process.env.MARIADB_MAINTENANCE_ENABLED !== "true") throw new Error("Refusing maintenance: MARIADB_MAINTENANCE_ENABLED=true is required");
requireIsolatedLocalMariaDb("maintenance");
const limitText = process.argv[3] ?? "500";
if (!/^\d+$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 5000) throw new Error("limit must be an integer between 1 and 5000");
const limit = Number(limitText);
const action = process.argv[2];
const statements = {
  cache: "DELETE FROM football_provider_cache WHERE stale_until<=UTC_TIMESTAMP(6) ORDER BY stale_until LIMIT ?",
  leases: "DELETE FROM football_cache_leases WHERE lease_expires_at<=UTC_TIMESTAMP(6) ORDER BY lease_expires_at LIMIT ?",
  cancelled: "DELETE FROM football_api_attempts WHERE state='CANCELLED' AND finalised_at<TIMESTAMPADD(DAY,-7,UTC_TIMESTAMP(6)) ORDER BY finalised_at LIMIT ?",
  finalised: "DELETE FROM football_api_attempts WHERE state='FINALISED' AND finalised_at<TIMESTAMPADD(DAY,-30,UTC_TIMESTAMP(6)) ORDER BY finalised_at LIMIT ?",
};
if (!(action in statements)) throw new Error("action must be cache, leases, cancelled, or finalised");
const pool = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, connectionLimit: 1, timezone: "Z" });
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const [result] = await connection.execute(statements[action], [limit]);
  await connection.commit();
  console.log(JSON.stringify({ action, affectedRows: result.affectedRows }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally { connection.release(); await pool.end(); }
