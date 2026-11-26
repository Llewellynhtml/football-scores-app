import test from "node:test";
import assert from "node:assert/strict";
import { createFootballRequester } from "./football-request.ts";
import { validateCacheRow } from "./football-cache.ts";

const silent = { warn() {}, error() {} };
const base = {
  url: new URL("https://provider.test/fixtures?date=2026-11-24"),
  apiKey: "test-key",
  pathname: "/fixtures",
  params: { date: "2026-11-24" },
  cacheKey: "fixture-key",
  persistence: true,
  ttlSeconds: 60,
  staleSeconds: 120,
};

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function harness(overrides = {}) {
  const entries = overrides.entries ?? new Map();
  const attempts = [];
  const outcomes = [];
  const fetchCalls = [];
  const deps = {
    fetch: async (...args) => {
      fetchCalls.push(args);
      return response({ response: [{ id: 2 }] });
    },
    readCache: async (key, allowStale = false) => {
      const item = entries.get(key) ?? null;
      if (!item || (!allowStale && item.stale)) return null;
      return item;
    },
    writeCache: async (key, payload) => {
      entries.set(key, { response: payload, stale: false, staleUntil: "2099-01-01T00:00:00.000Z" });
    },
    recordAttempt: () => attempts.push(true),
    recordOutcome: (...args) => outcomes.push(args),
    log: silent,
    ...overrides,
  };
  return { request: createFootballRequester(deps), entries, attempts, outcomes, fetchCalls };
}

test("fresh persistent cache hit avoids provider and usage recording", async () => {
  const h = harness({ entries: new Map([[base.cacheKey, { response: [{ id: 1 }], stale: false, staleUntil: "2099-01-01T00:00:00.000Z" }]]) });
  let freshness;
  assert.deepEqual(await h.request({ ...base, onFreshness: (value) => { freshness = value; } }), [{ id: 1 }]);
  assert.equal(freshness.state, "fresh");
  assert.equal(freshness.source, "persistent-cache");
  assert.equal(h.fetchCalls.length, 0);
  assert.equal(h.attempts.length, 0);
});

test("cache miss fetches with no-store and writes persistent cache", async () => {
  const h = harness();
  assert.deepEqual(await h.request(base), [{ id: 2 }]);
  assert.equal(h.fetchCalls[0][1].cache, "no-store");
  assert.deepEqual(h.entries.get(base.cacheKey).response, [{ id: 2 }]);
  assert.deepEqual(h.outcomes.map((x) => x[0]), ["success"]);
});

test("independent requester instances share a persistent cache", async () => {
  const entries = new Map();
  const first = harness({ entries });
  await first.request(base);
  const second = harness({ entries });
  assert.deepEqual(await second.request(base), [{ id: 2 }]);
  assert.equal(second.fetchCalls.length, 0);
});

test("expired entry is replaced after a cache miss", async () => {
  const entries = new Map([[base.cacheKey, { response: [{ id: 1 }], stale: true, staleUntil: "2099-01-01T00:00:00.000Z" }]]);
  const h = harness({ entries });
  assert.deepEqual(await h.request(base), [{ id: 2 }]);
  assert.equal(entries.get(base.cacheKey).stale, false);
});

test("stale cache is returned only after provider failure", async () => {
  const stale = { response: [{ id: 1 }], stale: true, staleUntil: "2099-01-01T00:00:00.000Z" };
  const h = harness({
    entries: new Map([[base.cacheKey, stale]]),
    fetch: async () => { throw new Error("offline"); },
  });
  let freshness;
  assert.deepEqual(await h.request({ ...base, onFreshness: (value) => { freshness = value; } }), [{ id: 1 }]);
  assert.equal(freshness.state, "stale");
  assert.deepEqual(h.outcomes.map((x) => x[0]), ["network_error"]);
});

test("fully expired, malformed payload, and invalid timestamps are rejected", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  assert.equal(validateCacheRow({ payload: [], expires_at: "2026-11-24T10:00:00Z", stale_until: "2026-11-24T11:00:00Z" }, true, now), null);
  assert.equal(validateCacheRow({ payload: {}, expires_at: "2026-11-24T13:00:00Z", stale_until: "2026-11-24T14:00:00Z" }, false, now), null);
  assert.equal(validateCacheRow({ payload: [], expires_at: "invalid", stale_until: "2026-11-24T14:00:00Z" }, false, now), null);
  assert.equal(validateCacheRow({ payload: [], expires_at: "2026-11-24T14:00:00Z", stale_until: "2026-11-24T13:00:00Z" }, false, now), null);
});

test("cache read and write failures degrade gracefully", async () => {
  const h = harness({
    readCache: async () => { throw new Error("database unavailable"); },
    writeCache: async () => { throw new Error("database unavailable"); },
  });
  assert.deepEqual(await h.request(base), [{ id: 2 }]);
  assert.equal(h.outcomes.length, 1);
});

test("HTTP and API-level failures have distinct, single usage outcomes", async () => {
  for (const [providerResponse, expected] of [
    [response({ error: "down" }, 503), "http_error"],
    [response({ errors: { quota: "exceeded" }, response: [] }), "provider_error"],
  ]) {
    const h = harness({ fetch: async () => providerResponse, readCache: async () => null });
    await assert.rejects(h.request(base));
    assert.equal(h.attempts.length, 1);
    assert.deepEqual(h.outcomes.map((x) => x[0]), [expected]);
  }
});

test("invalid provider JSON is recorded as a provider error", async () => {
  const h = harness({ fetch: async () => new Response("not-json", { status: 200 }), readCache: async () => null });
  await assert.rejects(h.request(base), /invalid JSON/);
  assert.deepEqual(h.outcomes.map((x) => x[0]), ["provider_error"]);
});

test("network failures and timeouts have distinct, single usage outcomes", async () => {
  const timeout = new Error("timed out"); timeout.name = "TimeoutError";
  for (const [failure, expected] of [[new Error("offline"), "network_error"], [timeout, "timeout"]]) {
    const h = harness({ fetch: async () => { throw failure; }, readCache: async () => null });
    await assert.rejects(h.request(base));
    assert.equal(h.attempts.length, 1);
    assert.deepEqual(h.outcomes.map((x) => x[0]), [expected]);
  }
});

test("concurrent identical requests deduplicate and cleanup after success", async () => {
  let resolveFetch;
  let providerCalls = 0;
  const h = harness({ fetch: () => {
    providerCalls += 1;
    if (providerCalls === 1) return new Promise((resolve) => { resolveFetch = resolve; });
    return Promise.resolve(response({ response: [{ id: 4 }] }));
  } });
  const first = h.request(base);
  const second = h.request(base);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.attempts.length, 1);
  resolveFetch(response({ response: [{ id: 3 }] }));
  assert.deepEqual(await Promise.all([first, second]), [[{ id: 3 }], [{ id: 3 }]]);
  h.entries.clear();
  await h.request(base);
  assert.equal(h.attempts.length, 2);
  assert.equal(providerCalls, 2);
});

test("in-flight entry cleans up after failure", async () => {
  const h = harness({ fetch: async () => { throw new Error("offline"); }, readCache: async () => null });
  await assert.rejects(h.request(base));
  await assert.rejects(h.request(base));
  assert.equal(h.attempts.length, 2);
});

test("persistence-disabled mode preserves Next fetch caching", async () => {
  const h = harness();
  await h.request({ ...base, persistence: false });
  assert.equal(h.fetchCalls[0][1].cache, undefined);
  assert.equal(h.fetchCalls[0][1].next.revalidate, 60);
  assert.equal(h.entries.size, 0);
});

test("duplicate quota attempt IDs cannot authorize another provider dispatch", async () => {
  const h = harness({ reserveQuota: async () => "ALREADY_DISPATCHED", markDispatched: async () => "ALREADY_DISPATCHED" });
  await assert.rejects(h.request(base), /temporarily unavailable/);
  assert.equal(h.fetchCalls.length, 0);
  assert.equal(h.attempts.length, 0);
});

test("reservation acknowledgement retry may dispatch once, but dispatch acknowledgement loss fails closed", async () => {
  const safe = harness({ reserveQuota: async () => "ALREADY_RESERVED", markDispatched: async () => "DISPATCHED" });
  assert.deepEqual(await safe.request(base), [{ id: 2 }]);
  assert.equal(safe.fetchCalls.length, 1);

  const ambiguous = harness({ reserveQuota: async () => "ALREADY_RESERVED", markDispatched: async () => "ALREADY_DISPATCHED" });
  await assert.rejects(ambiguous.request(base), /dispatch could not be authorised/);
  assert.equal(ambiguous.fetchCalls.length, 0);
});
