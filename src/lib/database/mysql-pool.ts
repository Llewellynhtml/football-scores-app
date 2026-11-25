import "server-only";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { mysqlConfig } from "@/lib/database/config";

type DatabaseGlobal = typeof globalThis & { __footballMysqlPool?: Pool };
const databaseGlobal = globalThis as DatabaseGlobal;
const initializedConnections = new WeakSet<object>();
const poolMetrics = {
  active: 0,
  pending: 0,
  acquisitions: 0,
  acquisitionTimeouts: 0,
  totalWaitMs: 0,
  maxWaitMs: 0,
};

export function getMysqlPoolDiagnostics() {
  return { ...poolMetrics, averageWaitMs: poolMetrics.acquisitions ? poolMetrics.totalWaitMs / poolMetrics.acquisitions : 0 };
}

export function markMysqlConnectionReleased() {
  poolMetrics.active = Math.max(0, poolMetrics.active - 1);
}

export function getMysqlPool() {
  if (databaseGlobal.__footballMysqlPool) return databaseGlobal.__footballMysqlPool;
  const config = mysqlConfig();
  if (!config.configured || !config.host || !config.database || !config.user || config.password === undefined) {
    throw new Error("MariaDB environment variables are not configured");
  }
  databaseGlobal.__footballMysqlPool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionLimit: config.connectionLimit,
    maxIdle: Math.min(config.maxIdle, config.connectionLimit),
    idleTimeout: config.idleTimeout,
    queueLimit: config.queueLimit,
    connectTimeout: config.connectTimeout,
    waitForConnections: true,
    timezone: "Z",
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4",
    decimalNumbers: true,
    dateStrings: true,
  });
  return databaseGlobal.__footballMysqlPool;
}

async function initializeSession(connection: PoolConnection) {
  if (initializedConnections.has(connection)) return;
  const config = mysqlConfig();
  await connection.query("SET SESSION time_zone = '+00:00'");
  await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
  await connection.query("SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES')");
  await connection.query("SET SESSION innodb_strict_mode = ON");
  await connection.query("SET SESSION innodb_lock_wait_timeout = ?", [config.lockWaitTimeout]);
  const [rows] = await connection.query<(RowDataPacket & { time_zone: string; isolation_level: string; sql_mode: string; strict_mode: number; lock_wait: number })[]>(
    "SELECT @@session.time_zone time_zone,@@session.transaction_isolation isolation_level,@@session.sql_mode sql_mode,@@session.innodb_strict_mode strict_mode,@@session.innodb_lock_wait_timeout lock_wait",
  );
  const session = rows[0];
  if (session?.time_zone !== "+00:00" || !/READ-COMMITTED/i.test(session?.isolation_level ?? "") || !/(^|,)STRICT_TRANS_TABLES(,|$)/.test(session?.sql_mode ?? "") || Number(session?.strict_mode) !== 1 || Number(session?.lock_wait) !== config.lockWaitTimeout) {
    throw new Error("MariaDB session settings could not be verified");
  }
  initializedConnections.add(connection);
}

export async function acquireMysqlConnection() {
  const pool = getMysqlPool();
  const timeoutMs = mysqlConfig().acquireTimeout;
  const startedAt = performance.now();
  poolMetrics.pending += 1;
  const acquisition = pool.getConnection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("MariaDB connection acquisition timed out")), timeoutMs);
    timer.unref?.();
  });
  let connection: PoolConnection;
  try {
    connection = await Promise.race([acquisition, timeout]);
  } catch (error) {
    if (error instanceof Error && error.message === "MariaDB connection acquisition timed out") poolMetrics.acquisitionTimeouts += 1;
    acquisition.then((late) => late.release(), () => undefined);
    throw error;
  } finally {
    poolMetrics.pending = Math.max(0, poolMetrics.pending - 1);
    if (timer) clearTimeout(timer);
  }
  try {
    await initializeSession(connection);
    const waitedMs = performance.now() - startedAt;
    poolMetrics.active += 1;
    poolMetrics.acquisitions += 1;
    poolMetrics.totalWaitMs += waitedMs;
    poolMetrics.maxWaitMs = Math.max(poolMetrics.maxWaitMs, waitedMs);
    return connection;
  } catch (error) {
    connection.destroy();
    throw new Error("MariaDB session initialization failed", { cause: error });
  }
}
