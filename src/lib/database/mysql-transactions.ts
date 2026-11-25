import type { PoolConnection } from "mysql2/promise";
import { acquireMysqlConnection, markMysqlConnectionReleased } from "@/lib/database/mysql-pool";

const transactionMetrics = {
  connectionOperations: 0,
  transactions: 0,
  commits: 0,
  rollbacks: 0,
  retries: 0,
  errors: 0,
  totalConnectionOperationMs: 0,
  totalTransactionMs: 0,
  maxTransactionMs: 0,
  operations: {} as Record<string, { count: number; errors: number; totalMs: number; maxMs: number }>,
};

function recordOperation(name: string, milliseconds: number, failed: boolean) {
  const operation = transactionMetrics.operations[name] ?? { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
  operation.count += 1;
  operation.errors += failed ? 1 : 0;
  operation.totalMs += milliseconds;
  operation.maxMs = Math.max(operation.maxMs, milliseconds);
  transactionMetrics.operations[name] = operation;
}

export function getMysqlTransactionDiagnostics() {
  return {
    ...transactionMetrics,
    operations: Object.fromEntries(Object.entries(transactionMetrics.operations).map(([name, value]) => [name, { ...value, averageMs: value.count ? value.totalMs / value.count : 0 }])),
    averageConnectionOperationMs: transactionMetrics.connectionOperations ? transactionMetrics.totalConnectionOperationMs / transactionMetrics.connectionOperations : 0,
    averageTransactionMs: transactionMetrics.transactions ? transactionMetrics.totalTransactionMs / transactionMetrics.transactions : 0,
  };
}

function transientTransactionError(error: unknown) {
  const candidate = error as { errno?: number; code?: string };
  return candidate?.errno === 1213 || candidate?.errno === 1205 || candidate?.code === "ER_LOCK_DEADLOCK" || candidate?.code === "ER_LOCK_WAIT_TIMEOUT";
}

export async function withMysqlConnection<T>(name: string, work: (connection: PoolConnection) => Promise<T>) {
  const startedAt = performance.now();
  let failed = false;
  const connection = await acquireMysqlConnection();
  try { return await work(connection); }
  catch (error) { failed = true; transactionMetrics.errors += 1; throw error; }
  finally {
    const milliseconds = performance.now() - startedAt;
    transactionMetrics.connectionOperations += 1;
    transactionMetrics.totalConnectionOperationMs += milliseconds;
    recordOperation(name, milliseconds, failed);
    markMysqlConnectionReleased(); connection.release();
  }
}

export async function withMysqlTransaction<T>(name: string, work: (connection: PoolConnection) => Promise<T>, attempts = 3) {
  const operationStartedAt = performance.now();
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const transactionStartedAt = performance.now();
    transactionMetrics.transactions += 1;
    const connection = await acquireMysqlConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      transactionMetrics.commits += 1;
      recordOperation(name, performance.now() - operationStartedAt, false);
      return result;
    } catch (error) {
      lastError = error;
      transactionMetrics.errors += 1;
      try { await connection.rollback(); transactionMetrics.rollbacks += 1; } catch { connection.destroy(); }
      if (!transientTransactionError(error) || attempt === attempts) {
        recordOperation(name, performance.now() - operationStartedAt, true);
        throw error;
      }
      transactionMetrics.retries += 1;
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt + Math.floor(Math.random() * 25)));
    } finally {
      const transactionMilliseconds = performance.now() - transactionStartedAt;
      transactionMetrics.totalTransactionMs += transactionMilliseconds;
      transactionMetrics.maxTransactionMs = Math.max(transactionMetrics.maxTransactionMs, transactionMilliseconds);
      markMysqlConnectionReleased();
      connection.release();
    }
  }
  recordOperation(name, performance.now() - operationStartedAt, true);
  throw lastError;
}
