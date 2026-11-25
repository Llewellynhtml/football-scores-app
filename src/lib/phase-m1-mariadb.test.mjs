import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../../mariadb/migrations/002_cache_and_quota.sql", import.meta.url), "utf8");
const adapter = readFileSync(new URL("./database/mysql-adapter.ts", import.meta.url), "utf8");
const pool = readFileSync(new URL("./database/mysql-pool.ts", import.meta.url), "utf8");
const capacity = readFileSync(new URL("../../scripts/mariadb-capacity.mjs", import.meta.url), "utf8");
const localGuard = readFileSync(new URL("../../scripts/lib/mariadb-local-guard.mjs", import.meta.url), "utf8");
const transactions = readFileSync(new URL("./database/mysql-transactions.ts", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../../.github/workflows/mariadb-integration.yml", import.meta.url), "utf8");

test("MariaDB operational tables use InnoDB, scoped daily usage and UTC-capable timestamps", () => {
  assert.equal((schema.match(/ENGINE=InnoDB/g) ?? []).length, 5);
  assert.match(schema, /PRIMARY KEY \(quota_scope, day\)/);
  assert.match(schema, /DATETIME\(6\)/);
  assert.match(schema, /CHECK \(JSON_VALID\(payload\)\)/);
});

test("MariaDB quota lifecycle locks a stable scope row and never uses GET_LOCK", () => {
  assert.match(adapter, /football_quota_locks WHERE quota_scope = \? FOR UPDATE/);
  assert.doesNotMatch(adapter, /GET_LOCK/i);
  assert.match(adapter, /UNKNOWN_OUTCOME/);
  assert.match(adapter, /withMysqlTransaction/);
});

test("MariaDB cache writes validate lease ownership under row lock", () => {
  assert.match(adapter, /football_cache_leases WHERE cache_key = \? FOR UPDATE/);
  assert.match(adapter, /owner_token = \? AND lease_expires_at > UTC_TIMESTAMP\(6\)/);
});

test("MariaDB sessions fail closed unless UTC, strict mode and lock bounds initialize", () => {
  assert.match(pool, /SET SESSION time_zone = '\+00:00'/);
  assert.match(pool, /READ COMMITTED/);
  assert.match(pool, /STRICT_TRANS_TABLES/);
  assert.match(pool, /innodb_strict_mode = ON/);
  assert.match(pool, /innodb_lock_wait_timeout/);
  assert.match(pool, /MariaDB session settings could not be verified/);
  assert.match(pool, /connection\.destroy\(\)/);
});

test("MariaDB capacity monitoring preserves provisional headroom thresholds", () => {
  assert.match(capacity, /MARIADB_DATABASE_CAPACITY_MB \?\? 3072/);
  assert.match(capacity, /MARIADB_CAPACITY_WARNING_PERCENT \?\? 60/);
  assert.match(capacity, /MARIADB_CAPACITY_ALERT_PERCENT \?\? 70/);
  assert.match(capacity, /DATA_LENGTH/);
  assert.match(capacity, /INDEX_LENGTH/);
});

test("MariaDB destructive test tooling refuses hosted identities and real provider keys", () => {
  assert.match(localGuard, /127\.0\.0\.1/);
  assert.match(localGuard, /football_scores_test_/);
  assert.match(localGuard, /integration-test-key/);
  assert.match(localGuard, /DATABASE_PROVIDER=mysql/);
});

test("MariaDB diagnostics measure operation and transaction latency", () => {
  assert.match(transactions, /totalTransactionMs/);
  assert.match(transactions, /averageConnectionOperationMs/);
  assert.match(transactions, /recordOperation/);
});

test("MariaDB CI pins the hosted patch and retains isolated safety values", () => {
  assert.match(workflow, /image: mariadb:11\.8\.9-ubi9/);
  assert.match(workflow, /MYSQL_HOST: 127\.0\.0\.1/);
  assert.match(workflow, /MYSQL_DATABASE: football_scores_test_ci/);
  assert.match(workflow, /API_FOOTBALL_KEY: integration-test-key/);
  assert.match(workflow, /timeout-minutes: 35/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
