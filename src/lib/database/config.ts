import "server-only";
import type { DatabaseProvider } from "@/lib/database/types";

function integer(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (value < minimum || value > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return value;
}

export function databaseProvider(): DatabaseProvider {
  const value = (process.env.DATABASE_PROVIDER ?? "supabase").trim().toLowerCase();
  if (value !== "supabase" && value !== "mysql") throw new Error("DATABASE_PROVIDER must be supabase or mysql");
  return value;
}

export function mysqlConfig() {
  const host = process.env.MYSQL_HOST?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD;
  return {
    host,
    database,
    user,
    password,
    port: integer("MYSQL_PORT", 3306, 1, 65535),
    connectionLimit: integer("MYSQL_CONNECTION_LIMIT", 5, 1, 25),
    maxIdle: integer("MYSQL_MAX_IDLE", 2, 0, 25),
    idleTimeout: integer("MYSQL_IDLE_TIMEOUT_MS", 10_000, 1_000, 60_000),
    queueLimit: integer("MYSQL_QUEUE_LIMIT", 50, 1, 1_000),
    connectTimeout: integer("MYSQL_CONNECT_TIMEOUT_MS", 5_000, 250, 30_000),
    acquireTimeout: integer("MYSQL_ACQUIRE_TIMEOUT_MS", 5_000, 250, 30_000),
    lockWaitTimeout: integer("MYSQL_LOCK_WAIT_TIMEOUT_SECONDS", 5, 1, 50),
    configured: Boolean(host && database && user && password),
  };
}

export function persistentDatabaseConfigured() {
  if (databaseProvider() === "mysql") return mysqlConfig().configured;
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}
