import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

function cacheKey(path, params, mode) {
  const sorted = Object.entries(params).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify([mode,path,sorted])).digest("hex");
}

test("cache key is stable across parameter order", () => {
  assert.equal(cacheKey("/fixtures",{league:39,season:2024},"free"),cacheKey("/fixtures",{season:2024,league:39},"free"));
});
test("cache key isolates data modes", () => {
  assert.notEqual(cacheKey("/fixtures",{league:39},"free"),cacheKey("/fixtures",{league:39},"current"));
});
test("cache key ignores undefined parameters", () => {
  assert.equal(cacheKey("/fixtures",{league:39,season:undefined},"free"),cacheKey("/fixtures",{league:39},"free"));
});
test("cache key isolates provider and response schema namespaces", () => {
  const params = { league: 39, season: 2026 };
  assert.notEqual(cacheKey("/fixtures", params, '{"schema":1,"origin":"prod"}'), cacheKey("/fixtures", params, '{"schema":2,"origin":"prod"}'));
  assert.notEqual(cacheKey("/fixtures", params, '{"schema":2,"origin":"prod"}'), cacheKey("/fixtures", params, '{"schema":2,"origin":"mock"}'));
});
