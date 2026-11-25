const loopbackHosts = new Set(["127.0.0.1", "localhost"]);

function boundedInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (value < minimum || value > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return value;
}

function strictLoopbackBase(raw, allowedPorts, label) {
  const url = new URL(raw);
  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname) || !allowedPorts.has(url.port) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${label} must be a plain HTTP loopback origin on an approved port`);
  }
  return url;
}

async function safeFetch(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) });
  if (response.status >= 300 && response.status < 400) throw new Error(`Redirects are forbidden during MariaDB tests: ${response.status}`);
  return response;
}

const appUrls = (process.env.MARIADB_LOAD_APP_URLS ?? "http://127.0.0.1:3213,http://127.0.0.1:3214")
  .split(",").map((value) => strictLoopbackBase(value.trim(), new Set(["3213", "3214"]), "Application URL"));
if (appUrls.length !== 2 || new Set(appUrls.map((url) => url.port)).size !== 2) throw new Error("Exactly two independent application origins are required");
const mockUrl = strictLoopbackBase(process.env.MARIADB_LOAD_MOCK_URL ?? "http://127.0.0.1:4310", new Set(["4310"]), "Mock URL");
const coldRequests = boundedInteger("MARIADB_LOAD_REQUESTS", 200, 2, 10_000);
const warmRequests = boundedInteger("MARIADB_LOAD_WARM_REQUESTS", 40, 2, 2_000);
const concurrency = boundedInteger("MARIADB_LOAD_CONCURRENCY", 10, 2, 50);
const fixedDate = process.env.FOOTBALL_FIXED_DATE_UTC;
if (!fixedDate || !/^\d{4}-\d{2}-\d{2}$/.test(fixedDate)) throw new Error("FOOTBALL_FIXED_DATE_UTC is required for deterministic load tests");
const path = process.env.MARIADB_LOAD_PATH ?? `/api/fixtures?date=${fixedDate}`;
const parsedPath = new URL(path, appUrls[0]);
if (/^[a-z][a-z\d+.-]*:/i.test(path) || parsedPath.pathname !== "/api/fixtures" || parsedPath.searchParams.get("date") !== fixedDate) throw new Error("MARIADB_LOAD_PATH must be the deterministic /api/fixtures date path");
const diagnosticsSecret = process.env.MARIADB_LOAD_CRON_SECRET;
if (!diagnosticsSecret || diagnosticsSecret !== process.env.CRON_SECRET) throw new Error("MARIADB_LOAD_CRON_SECRET must match the local CRON_SECRET");

const health = await safeFetch(new URL("/__health", mockUrl));
if (!health.ok || (await health.json()).service !== "mock-api-football") throw new Error("Mock API-Football is not ready");
const reset = await safeFetch(new URL("/__reset", mockUrl), { method: "POST" });
if (!reset.ok) throw new Error("Mock API-Football reset failed");

const readDiagnostics = () => Promise.all(appUrls.map((url) => safeFetch(new URL("/api/usage", url), { headers: { authorization: `Bearer ${diagnosticsSecret}` } }).then(async (response) => {
  if (!response.ok) throw new Error(`Local diagnostics failed with ${response.status}`);
  return response.json();
})));
const observed = (diagnostic) => Number(diagnostic.cacheHits ?? 0) + Number(diagnostic.providerFetchInvocations ?? 0) + Number(diagnostic.deduplicatedRequests ?? 0);
const providerCount = (stats) => Object.values(stats.requests ?? {}).reduce((sum, value) => sum + Number(value), 0);

async function runPhase(requests, phase) {
  const latencies = [];
  const failures = [];
  let cursor = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= requests) return;
      const appUrl = appUrls[index % appUrls.length];
      const before = performance.now();
      try {
        const response = await safeFetch(new URL(path, appUrl), { headers: { "x-load-test": `mariadb-${phase}` } });
        const body = await response.json();
        if (!response.ok || body.ok !== true || body.count !== 1 || body.fixtures?.[0]?.id !== 990001 || body.fixtures?.[0]?.home?.name !== "CI Home" || body.fixtures?.[0]?.away?.name !== "CI Away") {
          throw new Error(`Unexpected synthetic fixture response from port ${appUrl.port}`);
        }
      } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
      latencies.push(performance.now() - before);
    }
  }));
  latencies.sort((a, b) => a - b);
  const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] ?? 0;
  return { requests, failures, durationMs: performance.now() - started, latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: latencies.at(-1) ?? 0 } };
}

const diagnosticsBefore = await readDiagnostics();
const cold = await runPhase(coldRequests, "cold");
const coldStats = await safeFetch(new URL("/__stats", mockUrl)).then((response) => response.json());
const diagnosticsAfterCold = await readDiagnostics();
if (cold.failures.length) throw new Error(`Cold phase failures: ${cold.failures.slice(0, 3).join("; ")}`);
if (providerCount(coldStats) !== 1) throw new Error(`Cold phase must issue exactly one provider request; observed ${providerCount(coldStats)}`);
for (let index = 0; index < appUrls.length; index += 1) {
  if (!diagnosticsAfterCold[index].instanceId || diagnosticsAfterCold[index].instanceId === diagnosticsAfterCold[1 - index].instanceId) throw new Error("Both independent application instance IDs must be present and distinct");
  if (observed(diagnosticsAfterCold[index]) <= observed(diagnosticsBefore[index])) throw new Error(`No fixture traffic was observed on ${diagnosticsAfterCold[index].instanceId}`);
}

const warm = await runPhase(warmRequests, "warm");
const warmStats = await safeFetch(new URL("/__stats", mockUrl)).then((response) => response.json());
const diagnosticsAfterWarm = await readDiagnostics();
if (warm.failures.length) throw new Error(`Warm phase failures: ${warm.failures.slice(0, 3).join("; ")}`);
if (providerCount(warmStats) !== 1) throw new Error(`Warm phase must add zero provider requests; cumulative count is ${providerCount(warmStats)}`);

console.log(JSON.stringify({ concurrency, deterministicDate: fixedDate, cold, warm, provider: { coldRequests: 1, warmAdditionalRequests: 0, stats: warmStats }, diagnosticsBefore, diagnosticsAfterCold, diagnosticsAfterWarm, note: "GitHub runner metrics do not establish Hostinger IOPS capacity." }, null, 2));
