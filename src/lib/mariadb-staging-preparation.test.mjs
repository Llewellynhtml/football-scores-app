import test from "node:test";
import assert from "node:assert/strict";
import { classifyMigration, migrationChecksum, validateMigrationHistory } from "../../scripts/lib/mariadb-migrations.mjs";
import { requireHostedStagingMariaDb, verifyHostedStagingIdentity } from "../../scripts/lib/mariadb-hosted-staging-guard.mjs";
import { syntheticProviderPolicy, verifySyntheticDispatch, verifySyntheticResponse } from "./football-synthetic-provider.ts";

test("migration history accepts fresh and ordered states and rejects drift or invalid history", () => {
  const files = ["001_schema_migrations.sql", "002_cache_and_quota.sql", "003_constraints.sql"];
  const checksum = migrationChecksum("CREATE TABLE example (id INT);");
  assert.equal(classifyMigration(undefined, checksum, files[0]), "apply");
  assert.equal(classifyMigration(checksum, checksum, files[0]), "unchanged");
  assert.throws(() => classifyMigration("original", "modified", files[0]), /checksum changed/);
  assert.throws(() => classifyMigration("original", "modified", files[2]), /checksum changed/);
  assert.doesNotThrow(() => validateMigrationHistory({ files, records: [], existingTables: [], migrationTableExists: false }));
  assert.doesNotThrow(() => validateMigrationHistory({ files, records: [{ version: files[0], checksum_sha256: checksum }], existingTables: ["schema_migrations"], migrationTableExists: true }));
  assert.throws(() => validateMigrationHistory({ files, records: [], existingTables: ["orphan"], migrationTableExists: false }), /non-empty database/);
  assert.throws(() => validateMigrationHistory({ files, records: [{ version: files[1], checksum_sha256: checksum }], existingTables: ["schema_migrations"], migrationTableExists: true }), /ordered prefix/);
  assert.throws(() => validateMigrationHistory({ files, records: [{ version: "999_unknown.sql", checksum_sha256: checksum }], existingTables: ["schema_migrations"], migrationTableExists: true }), /unknown versions/);
  assert.throws(() => validateMigrationHistory({ files, records: [{ version: files[0], checksum_sha256: "bad" }], existingTables: ["schema_migrations"], migrationTableExists: true }), /malformed checksum/);
});

function withEnvironment(names, values, callback) {
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  Object.assign(process.env, values);
  try { callback(); }
  finally { for (const name of names) previous[name] === undefined ? delete process.env[name] : process.env[name] = previous[name]; }
}

const databaseEnvNames = ["MARIADB_HOSTED_STAGING_AUTHORISED", "MARIADB_HOSTED_STAGING_TARGET_APPROVED", "MARIADB_HOSTED_STAGING_MUTATION", "MARIADB_HOSTED_STAGING_APPROVED_DATABASE", "MARIADB_HOSTED_STAGING_APPROVED_USER", "MARIADB_HOSTED_STAGING_CONNECTION_MODE", "MARIADB_ISOLATED_DATABASE", "DATABASE_PROVIDER", "MYSQL_DATABASE", "MYSQL_HOST", "MYSQL_USER", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];

test("hosted database guard accepts only an independently approved Hostinger loopback target", () => {
  withEnvironment(databaseEnvNames, {
    MARIADB_HOSTED_STAGING_AUTHORISED: "true", MARIADB_HOSTED_STAGING_TARGET_APPROVED: "true", MARIADB_HOSTED_STAGING_MUTATION: "migration",
    MARIADB_HOSTED_STAGING_CONNECTION_MODE: "hostinger-internal-loopback", MARIADB_HOSTED_STAGING_APPROVED_DATABASE: "u123_football_stage_m6",
    MARIADB_HOSTED_STAGING_APPROVED_USER: "u123_stage_migrator", DATABASE_PROVIDER: "mysql", MYSQL_DATABASE: "u123_football_stage_m6",
    MYSQL_HOST: "127.0.0.1", MYSQL_USER: "u123_stage_migrator",
  }, () => {
    assert.equal(requireHostedStagingMariaDb("migration", { mutating: true }).database, "u123_football_stage_m6");
    process.env.MYSQL_DATABASE = "u123_wrong";
    assert.throws(() => requireHostedStagingMariaDb("migration", { mutating: true }), /database does not match/);
    process.env.MYSQL_DATABASE = "u123_football_stage_m6"; process.env.MYSQL_USER = "u123_wrong";
    assert.throws(() => requireHostedStagingMariaDb("migration", { mutating: true }), /user does not match/);
    process.env.MYSQL_USER = "u123_stage_migrator"; process.env.MARIADB_HOSTED_STAGING_AUTHORISED = "false";
    assert.throws(() => requireHostedStagingMariaDb("migration"), /authorisation/);
    process.env.MARIADB_HOSTED_STAGING_AUTHORISED = "true"; process.env.MYSQL_HOST = "db.example";
    assert.throws(() => requireHostedStagingMariaDb("migration"), /127\.0\.0\.1/);
    process.env.MYSQL_HOST = "127.0.0.1"; process.env.MARIADB_HOSTED_STAGING_APPROVED_DATABASE = "u123_production"; process.env.MYSQL_DATABASE = "u123_production";
    assert.throws(() => requireHostedStagingMariaDb("migration"), /production-like/);
    process.env.MARIADB_HOSTED_STAGING_APPROVED_DATABASE = "u123_football_stage_m6"; process.env.MYSQL_DATABASE = "u123_football_stage_m6"; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://forbidden.example";
    assert.throws(() => requireHostedStagingMariaDb("migration"), /Supabase/);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.MARIADB_HOSTED_STAGING_MUTATION = "maintenance";
    assert.throws(() => requireHostedStagingMariaDb("migration", { mutating: true }), /mutation/);
  });
});

test("hosted identity verifies selected database, authenticated user and schema", () => {
  const approved = { approvedDatabase: "u123_football_stage_m6", approvedUser: "u123_stage_runtime" };
  const expectedTables = ["schema_migrations"];
  assert.equal(verifyHostedStagingIdentity({ ...approved, actualDatabase: approved.approvedDatabase, actualAuthenticatedUser: `${approved.approvedUser}@localhost`, existingTables: expectedTables, expectedTables }), true);
  assert.throws(() => verifyHostedStagingIdentity({ ...approved, actualDatabase: "wrong", actualAuthenticatedUser: `${approved.approvedUser}@localhost`, existingTables: [], expectedTables: [] }), /database identity/);
  assert.throws(() => verifyHostedStagingIdentity({ ...approved, actualDatabase: approved.approvedDatabase, actualAuthenticatedUser: "wrong@localhost", existingTables: [], expectedTables: [] }), /Authenticated/);
  assert.throws(() => verifyHostedStagingIdentity({ ...approved, actualDatabase: approved.approvedDatabase, actualAuthenticatedUser: `${approved.approvedUser}@localhost`, existingTables: ["unexpected"], expectedTables: [] }), /Unexpected/);
  assert.throws(() => verifyHostedStagingIdentity({ ...approved, actualDatabase: approved.approvedDatabase, actualAuthenticatedUser: `${approved.approvedUser}@localhost`, existingTables: [], expectedTables }), /Missing/);
});

const providerEnvNames = ["MARIADB_HOSTED_STAGING_AUTHORISED", "API_FOOTBALL_PROVIDER_MODE", "API_FOOTBALL_BASE_URL", "API_FOOTBALL_SYNTHETIC_APPROVED_ORIGIN", "API_FOOTBALL_KEY", "API_SPORTS_KEY", "FOOTBALL_QUOTA_SCOPE"];

test("synthetic policies enforce loopback and HTTPS origins at dispatch and response boundaries", () => {
  withEnvironment(providerEnvNames, {
    MARIADB_HOSTED_STAGING_AUTHORISED: "true", API_FOOTBALL_PROVIDER_MODE: "synthetic-loopback", API_FOOTBALL_BASE_URL: "http://127.0.0.1:4310/",
    API_FOOTBALL_SYNTHETIC_APPROVED_ORIGIN: "http://127.0.0.1:4310", API_FOOTBALL_KEY: "hostinger-staging-synthetic-example", FOOTBALL_QUOTA_SCOPE: "hostinger-stage-m6-example",
  }, () => {
    const policy = syntheticProviderPolicy();
    assert.equal(policy?.mode, "synthetic-loopback");
    assert.doesNotThrow(() => verifySyntheticDispatch(new URL("http://127.0.0.1:4310/fixtures"), process.env.API_FOOTBALL_KEY, policy));
    assert.throws(() => verifySyntheticDispatch(new URL("http://127.0.0.1:4311/fixtures"), process.env.API_FOOTBALL_KEY, policy), /not approved/);
    assert.throws(() => verifySyntheticResponse(new Response(null, { status: 302 }), policy), /redirects/);
    assert.throws(() => verifySyntheticResponse(new Response("{}", { status: 200 }), policy), /marker/);
    assert.doesNotThrow(() => verifySyntheticResponse(new Response("{}", { status: 200, headers: { "x-football-synthetic": "true" } }), policy));
    process.env.API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io/"; process.env.API_FOOTBALL_SYNTHETIC_APPROVED_ORIGIN = "https://v3.football.api-sports.io"; process.env.API_FOOTBALL_PROVIDER_MODE = "synthetic-https";
    assert.throws(() => syntheticProviderPolicy(), /Real API-Football/);
    process.env.API_FOOTBALL_BASE_URL = "https://synthetic-stage.example/"; process.env.API_FOOTBALL_SYNTHETIC_APPROVED_ORIGIN = "https://synthetic-stage.example"; process.env.API_FOOTBALL_KEY = "real-looking-key";
    assert.throws(() => syntheticProviderPolicy(), /synthetic provider credential/);
  });
});
