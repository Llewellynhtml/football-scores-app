import test from "node:test";
import assert from "node:assert/strict";
import { parseProviderEnvelope, rateLimitHeaders } from "./football-provider-contract.ts";
import { fixtureIdsParameter, normalizeFixtureIds } from "./fixture-batching.ts";
import { classifyFixtureStatus } from "./football-status.ts";
import { utcDatesForLocalDay } from "./football-timezone.ts";
import { quotaAllowsRequest } from "./football-quota.ts";

test("provider envelope preserves arrays, objects, results and paging", () => {
  const array = parseProviderEnvelope({ get: "players", parameters: { page: "2" }, errors: [], results: 1, paging: { current: 2, total: 3 }, response: [{ id: 1 }] }, Array.isArray);
  assert.deepEqual(array.paging, { current: 2, total: 3 });
  assert.equal(array.results, 1);
  const object = parseProviderEnvelope({ errors: {}, results: 1, response: { requests: {} } }, (value) => typeof value === "object" && value !== null && !Array.isArray(value));
  assert.deepEqual(object.response, { requests: {} });
});

test("provider errors differ from legitimate empty results", () => {
  assert.deepEqual(parseProviderEnvelope({ errors: [], results: 0, response: [] }, Array.isArray).response, []);
  assert.throws(() => parseProviderEnvelope({ errors: { plan: "not available" }, results: 0, response: [] }, Array.isArray), /provider error/);
});

test("all four official rate-limit headers are captured", () => {
  assert.deepEqual(rateLimitHeaders(new Headers({
    "x-ratelimit-requests-limit": "100", "x-ratelimit-requests-remaining": "80",
    "x-ratelimit-limit": "10", "x-ratelimit-remaining": "7",
  })), { dailyLimit: 100, dailyRemaining: 80, minuteLimit: 10, minuteRemaining: 7 });
});

test("fixture batching deduplicates, sorts and enforces twenty IDs", () => {
  assert.deepEqual(normalizeFixtureIds([3, 1, 3, -1]), [1, 3]);
  assert.equal(fixtureIdsParameter([3, 1]), "1-3");
  assert.throws(() => normalizeFixtureIds(Array.from({ length: 21 }, (_, index) => index + 1)), /at most 20/);
});

test("all documented fixture statuses are classified", () => {
  assert.equal(classifyFixtureStatus("TBD"), "scheduled");
  assert.equal(classifyFixtureStatus("HT"), "halftime");
  assert.equal(classifyFixtureStatus("P"), "penalties");
  assert.equal(classifyFixtureStatus("PEN"), "completed");
  assert.equal(classifyFixtureStatus("PST"), "postponed");
  assert.equal(classifyFixtureStatus("ABD"), "abandoned");
  assert.equal(classifyFixtureStatus("AWD"), "administrative");
});

test("local calendar days resolve adjacent UTC dates across DST and year boundaries", () => {
  assert.deepEqual(utcDatesForLocalDay("2027-01-01", "Pacific/Auckland"), ["2026-12-31", "2027-01-01"]);
  assert.ok(utcDatesForLocalDay("2026-03-29", "Europe/London").length <= 2);
  assert.throws(() => utcDatesForLocalDay("2026-01-01", "Invalid/Zone"), /Invalid IANA/);
});

test("per-minute reserve protects essential capacity", () => {
  const config = { enabled: true, dailyLimit: 100, reserve: 10, minuteLimit: 10, minuteReserve: 2, cooldownMs: 1000 };
  assert.equal(quotaAllowsRequest(20, false, config, 8), false);
  assert.equal(quotaAllowsRequest(20, true, config, 8), true);
  assert.equal(quotaAllowsRequest(20, true, config, 10), false);
});
