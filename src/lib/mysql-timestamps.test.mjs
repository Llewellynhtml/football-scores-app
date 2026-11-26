import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalUtcTimestamp, mariaDbDateTime, normalizeMariaDbCacheTimestamps, timestampsRepresentSameInstant } from "./database/mysql-timestamps.ts";
import { validateCacheRow } from "./football-cache.ts";

test("MariaDB timestamps preserve exact UTC identity", () => {
  assert.equal(timestampsRepresentSameInstant("2026-11-25 21:16:08.123", "2026-11-25 21:16:08.123000"), true);
  assert.equal(timestampsRepresentSameInstant("2026-11-25T23:16:08.123+02:00", "2026-11-25T21:16:08.123000Z"), true);
  assert.equal(timestampsRepresentSameInstant("2026-11-25 21:16:08.123", "2026-11-25 21:16:08.124"), false);
  assert.equal(timestampsRepresentSameInstant("2026-11-25 21:16:08.123001", "2026-11-25 21:16:08.123002"), false);
  assert.equal(canonicalUtcTimestamp("2026-12-01 00:00:00"), "2026-12-01T00:00:00.000000Z");
  assert.equal(mariaDbDateTime("2026-11-25T21:16:08.123Z"), "2026-11-25 21:16:08.123000");
  for (const invalid of ["", "not-a-date", "2026-02-30 00:00:00", "2026-11-25T21:16:08+25:00"]) assert.throws(() => canonicalUtcTimestamp(invalid));
});

function cacheOutcomes() {
  const now = Date.UTC(2026, 10, 25, 21, 16, 8, 500);
  const normalize = (expires_at, stale_until, updated_at = "2026-11-25 21:16:08.000000") => normalizeMariaDbCacheTimestamps({ payload: [{ id: 1 }], expires_at, stale_until, updated_at });
  const fresh = validateCacheRow(normalize("2026-11-25 21:16:09", "2026-11-25 21:16:10.000000"), false, now);
  const stale = validateCacheRow(normalize("2026-11-25 21:16:08.000", "2026-11-25 21:16:10.000000"), true, now);
  const staleRejected = validateCacheRow(normalize("2026-11-25 21:16:08.000", "2026-11-25 21:16:10.000000"), false, now);
  const expired = validateCacheRow(normalize("2026-11-25 21:16:07", "2026-11-25 21:16:08.500000"), true, now);
  const reversed = validateCacheRow(normalize("2026-11-25 21:16:10", "2026-11-25 21:16:09"), true, now);
  return { fresh: fresh?.stale, stale: stale?.stale, staleRejected, expired, reversed };
}

test("MariaDB cache timestamps are interpreted as UTC", () => {
  assert.deepEqual(cacheOutcomes(), { fresh: false, stale: true, staleRejected: null, expired: null, reversed: null });
  assert.throws(() => normalizeMariaDbCacheTimestamps({ payload: [], expires_at: "invalid", stale_until: "2026-11-25 21:16:10" }));
});

test("MariaDB cache UTC behavior is independent of the Node process timezone", () => {
  const moduleUrl = new URL("./database/mysql-timestamps.ts", import.meta.url).href;
  const cacheUrl = new URL("./football-cache.ts", import.meta.url).href;
  const script = `const timestampsModule=await import(${JSON.stringify(moduleUrl)}); const cacheModule=await import(${JSON.stringify(cacheUrl)}); const timestamps=timestampsModule.default??timestampsModule; const cache=cacheModule.default??cacheModule; const row=timestamps.normalizeMariaDbCacheTimestamps({payload:[{id:1}],expires_at:'2026-11-25 21:16:09.000000',stale_until:'2026-11-25 21:16:10.000000',updated_at:'2026-11-25 21:16:08.000000'}); console.log(JSON.stringify(cache.validateCacheRow(row,false,Date.UTC(2026,10,25,21,16,8,500))));`;
  const run = (timezone) => execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], { encoding: "utf8", env: { ...process.env, TZ: timezone } }).trim();
  assert.equal(run("UTC"), run("Africa/Johannesburg"));
});
