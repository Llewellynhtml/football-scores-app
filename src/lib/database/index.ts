import "server-only";
import { databaseProvider } from "@/lib/database/config";
import type { FootballPersistenceAdapter } from "@/lib/database/types";
import { supabaseAdapter } from "@/lib/database/supabase-adapter";
import { mysqlAdapter } from "@/lib/database/mysql-adapter";
import { getMysqlPoolDiagnostics } from "@/lib/database/mysql-pool";
import { getMysqlTransactionDiagnostics } from "@/lib/database/mysql-transactions";

export function getFootballPersistenceAdapter(): FootballPersistenceAdapter {
  return databaseProvider() === "mysql" ? mysqlAdapter : supabaseAdapter;
}

export function getDatabaseDiagnostics() {
  if (databaseProvider() !== "mysql") return null;
  return { pool: getMysqlPoolDiagnostics(), databaseOperations: getMysqlTransactionDiagnostics() };
}

export { databaseProvider, persistentDatabaseConfigured } from "@/lib/database/config";
