import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb } from "./lib/mariadb-local-guard.mjs";

const expected = requireIsolatedLocalMariaDb("migration integrity test");
if (process.env.GITHUB_ACTIONS !== "true" || expected.database !== "football_scores_test_ci") {
  throw new Error("Migration checksum tampering is restricted to the disposable GitHub Actions database");
}
const migration = "001_schema_migrations.sql";

function runMigration() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/mariadb-migrate.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const timeout = setTimeout(() => child.kill("SIGTERM"), 30_000);
    child.on("close", (code) => { clearTimeout(timeout); resolve({ code, output }); });
  });
}

const connection = await mysql.createConnection({
  host: expected.host, port: Number(process.env.MYSQL_PORT ?? 3306), database: expected.database,
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z", connectTimeout: 5000,
});
let originalChecksum;
try {
  const unchanged = await runMigration();
  assert.equal(unchanged.code, 0, unchanged.output);
  assert.match(unchanged.output, /unchanged 001_schema_migrations\.sql/);
  const [rows] = await connection.execute("SELECT checksum_sha256 FROM schema_migrations WHERE version=?", [migration]);
  originalChecksum = rows[0]?.checksum_sha256;
  assert.match(originalChecksum ?? "", /^[a-f0-9]{64}$/);
  await connection.execute("UPDATE schema_migrations SET checksum_sha256=? WHERE version=?", ["0".repeat(64), migration]);
  const rejected = await runMigration();
  assert.notEqual(rejected.code, 0, "Changed migration checksum was silently accepted");
  assert.match(rejected.output, /Applied migration checksum changed: 001_schema_migrations\.sql/);
  console.log("MariaDB migration re-execution and migration 001 checksum rejection passed");
} finally {
  if (originalChecksum) await connection.execute("UPDATE schema_migrations SET checksum_sha256=? WHERE version=?", [originalChecksum, migration]);
  await connection.end();
}
