import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const workflow = read("../../.github/workflows/mariadb-integration.yml");
const load = read("../../scripts/load-test-mariadb.mjs");
const mock = read("../../scripts/mock-api-football.mjs");
const persistence = read("../../scripts/verify-mariadb-persistence.mjs");
const transactions = read("./database/mysql-transactions.ts");
const adapterTest = read("../../scripts/test-mariadb-adapter.mts");
const packageJson = JSON.parse(read("../../package.json"));
const packageLock = JSON.parse(read("../../package-lock.json"));

test("CI-01 development branch triggers MariaDB workflow", () => {
  assert.match(workflow, /push:\s*\n\s*branches: \["feat\/phase1b-persistent-football-cache"\]/);
});

test("CI-02 cold and warm phases assert exactly one then zero provider requests", () => {
  assert.match(load, /Cold phase must issue exactly one provider request/);
  assert.match(load, /Warm phase must add zero provider requests/);
  assert.match(workflow, /FOOTBALL_DAILY_REQUEST_LIMIT: "100"/);
});

test("CI-03 both independent application instances must receive fixture traffic", () => {
  assert.match(load, /Both independent application instance IDs must be present and distinct/);
  assert.match(load, /No fixture traffic was observed/);
  assert.match(workflow, /APP_INSTANCE_ID=ci-3213/);
  assert.match(workflow, /APP_INSTANCE_ID=ci-3214/);
});

test("CI-04 outage uses cleared cache and quota and requires a controlled error", () => {
  assert.match(workflow, /DELETE FROM football_provider_cache; DELETE FROM football_cache_leases; DELETE FROM football_api_attempts; DELETE FROM football_api_usage_daily; DELETE FROM football_quota_locks/);
  assert.match(workflow, /test:mariadb:outage/);
  assert.match(persistence, /response\.status !== 503/);
  assert.match(persistence, /Database outage consumed a mock-provider request/);
});

test("CI-05 synthetic football response content is validated", () => {
  assert.match(mock, /id: 990001/);
  assert.match(load, /body\.fixtures\?\.\[0\]\?\.id !== 990001/);
  assert.match(load, /CI Home/);
});

test("CI-06 mock provider has readiness endpoint and checks", () => {
  assert.match(mock, /url\.pathname === "\/__health"/);
  assert.match(load, /Mock API-Football is not ready/);
  assert.match(workflow, /4310\/__health/);
});

test("CI-07 harnesses enforce strict loopback URLs, no redirects and timeouts", () => {
  for (const source of [load, persistence]) {
    assert.match(source, /redirect: "manual"/);
    assert.match(source, /AbortSignal\.timeout/);
    assert.match(source, /127\.0\.0\.1/);
  }
  assert.match(load, /must be an integer/);
});

test("CI-08 transactions roll back and release on failure", () => {
  assert.match(transactions, /await connection\.rollback\(\)/);
  assert.match(transactions, /finally[\s\S]*connection\.release\(\)/);
  assert.match(adapterTest, /const circular: unknown\[\]/);
  assert.match(adapterTest, /assert\.rejects\(mysqlAdapter\.writeCachedIfLeaseOwner/);
  assert.match(adapterTest, /mysqlAdapter\.health\(\)/);
});

test("CI-09 workflow and harness use deterministic fixture date", () => {
  assert.match(workflow, /FOOTBALL_FIXED_DATE_UTC: "2026-11-25"/);
  assert.match(load, /FOOTBALL_FIXED_DATE_UTC is required/);
});

test("CI-10 workflow terminates process groups and verifies restart", () => {
  assert.match(workflow, /setsid npm run start/);
  assert.match(workflow, /kill -- -"\$APP1_PID" -"\$APP2_PID"/);
  assert.match(workflow, /A terminated application process is still serving traffic/);
  assert.match(workflow, /APP_INSTANCE_ID=ci-3213-restarted/);
});

test("CI-11 workflow separates migration and runtime database users", () => {
  assert.match(workflow, /football_migrator/);
  assert.match(workflow, /football_runtime/);
  assert.match(workflow, /MYSQL_USER: football_migrator/);
  assert.match(workflow, /MYSQL_USER: football_runtime/);
});

test("CI-12 dependency, migration, adapter and workflow verification are invoked", () => {
  assert.equal(packageJson.dependencies.mysql2, "^3.24.6");
  assert.equal(packageJson.dependencies["server-only"], "0.0.1");
  assert.ok(packageLock.packages["node_modules/mysql2"]);
  assert.equal(packageLock.packages["node_modules/server-only"]?.version, "0.0.1");
  for (const command of ["npm ci", "npm run db:mariadb:migrate", "npm run test:mariadb:adapter", "npm run test:mariadb:load", "npm run test:mariadb:restore"]) assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
