import test from "node:test";
import assert from "node:assert/strict";
import { cachePolicy } from "./football-cache.ts";
import { createFootballRequester } from "./football-request.ts";
import { quotaAllowsRequest } from "./football-quota.ts";
import { createUsageQueue } from "./usage-queue.ts";

const requestBase = { url: new URL("https://provider.test/fixtures"), apiKey: "x", pathname: "/fixtures", params: { date: "2026-11-24" }, cacheKey: "a".repeat(64), persistence: true, ttlSeconds: 60, staleSeconds: 120, waitMilliseconds: 10, pollMilliseconds: 5 };
const ok = () => new Response(JSON.stringify({ response: [{ id: 1 }] }), { status: 200 });

test("cache policies keep live data short and stable metadata long", () => {
  assert.deepEqual(cachePolicy("/fixtures", { live: "all" }, "current"), { ttlSeconds: 20, staleSeconds: 60 });
  assert.equal(cachePolicy("/leagues", {}, "current").ttlSeconds, 86400);
  assert.equal(cachePolicy("/teams", {}, "current").staleSeconds, 259200);
});

test("quota reserve protects essential capacity and disabled mode bypasses guard", () => {
  const config = { enabled: true, dailyLimit: 100, reserve: 10, minuteLimit: 10, minuteReserve: 2, cooldownMs: 1 };
  assert.equal(quotaAllowsRequest(90, false, config), false);
  assert.equal(quotaAllowsRequest(90, true, config), true);
  assert.equal(quotaAllowsRequest(1000, false, { ...config, enabled: false }), true);
});

test("distributed waiter reuses cache populated by lease owner", async () => {
  let reads = 0; let fetches = 0;
  const requester = createFootballRequester({
    fetch: async () => { fetches++; return ok(); },
    readCache: async () => (++reads >= 2 ? { response: [{ id: 9 }], stale: false, staleUntil: "2099-01-01T00:00:00Z" } : null),
    writeCache: async () => {}, acquireLease: async () => false, releaseLease: async () => {},
    recordAttempt: () => {}, recordOutcome: () => {}, sleep: async () => {},
  });
  assert.deepEqual(await requester(requestBase), [{ id: 9 }]);
  assert.equal(fetches, 0);
});

test("lease owner rechecks cache and releases without provider access", async () => {
  let reads = 0; let released = 0;
  const requester = createFootballRequester({
    fetch: async () => { throw new Error("must not fetch"); },
    readCache: async () => (++reads === 2 ? { response: [{ id: 7 }], stale: false, staleUntil: "2099-01-01T00:00:00Z" } : null),
    writeCache: async () => {}, acquireLease: async () => true, releaseLease: async () => { released++; },
    recordAttempt: () => {}, recordOutcome: () => {},
  });
  assert.deepEqual(await requester(requestBase), [{ id: 7 }]);
  assert.equal(released, 1);
});

test("lease failures degrade to provider access", async () => {
  let attempts = 0;
  const requester = createFootballRequester({
    fetch: async () => ok(), readCache: async () => null, writeCache: async () => {},
    acquireLease: async () => { throw new Error("db offline"); }, recordAttempt: () => { attempts++; }, recordOutcome: () => {},
    log: { warn() {}, error() {} },
  });
  assert.deepEqual(await requester(requestBase), [{ id: 1 }]);
  assert.equal(attempts, 1);
});

test("usage queue is bounded and drops events after bounded retries", async () => {
  const queue = createUsageQueue(async () => { throw new Error("offline"); }, { maxSize: 1, maxAttempts: 1, baseDelayMs: 0, random: () => 0 });
  const event = { attemptId: crypto.randomUUID(), quotaScope: "test", attemptedAt: new Date().toISOString(), outcome: "network_error", status: null, providerLimit: null, providerRemaining: null, providerMinuteLimit: null, providerMinuteRemaining: null, quotaObservedAt: null };
  assert.equal(queue.enqueue(event), true);
  assert.equal(queue.enqueue({ ...event, attemptId: crypto.randomUUID() }), false);
  await queue.flush();
  assert.equal(queue.diagnostics().dropped, 2);
  assert.equal(queue.diagnostics().pending, 0);
});

test("provider 429 starts a bounded cooldown and prevents an immediate retry", async () => {
  let fetches = 0;
  const requester = createFootballRequester({
    fetch: async () => { fetches++; return new Response("{}", { status: 429 }); }, readCache: async () => null,
    writeCache: async () => {}, recordAttempt: () => {}, recordOutcome: () => {}, log: { warn() {}, error() {} },
  });
  await assert.rejects(requester({ ...requestBase, persistence: false, cooldownMilliseconds: 50 }));
  await assert.rejects(requester({ ...requestBase, persistence: false, cooldownMilliseconds: 50 }), /temporarily unavailable/);
  assert.equal(fetches, 1);
  await new Promise((resolve) => setTimeout(resolve, 60));
  await assert.rejects(requester({ ...requestBase, persistence: false, cooldownMilliseconds: 50 }));
  assert.equal(fetches, 2);
});
