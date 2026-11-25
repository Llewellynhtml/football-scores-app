function loopback(raw, port, label) {
  const url = new URL(raw);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${label} must be a plain loopback origin on port ${port}`);
  }
  return url;
}
async function safeFetch(url) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  if (response.status >= 300 && response.status < 400) throw new Error("Redirects are forbidden during persistence verification");
  return response;
}
const appUrl = loopback(process.env.MARIADB_VERIFY_APP_URL ?? "http://127.0.0.1:3213", "3213", "Application URL");
const mockUrl = loopback(process.env.MARIADB_LOAD_MOCK_URL ?? "http://127.0.0.1:4310", "4310", "Mock URL");
const fixedDate = process.env.FOOTBALL_FIXED_DATE_UTC;
if (!fixedDate || !/^\d{4}-\d{2}-\d{2}$/.test(fixedDate)) throw new Error("FOOTBALL_FIXED_DATE_UTC is required");
const outageMode = process.argv.includes("--outage");
const before = await safeFetch(new URL("/__stats", mockUrl)).then((value) => value.json());
const response = await safeFetch(new URL(`/api/fixtures?date=${fixedDate}`, appUrl));
const body = await response.json();
const stats = await safeFetch(new URL("/__stats", mockUrl)).then((value) => value.json());
if (outageMode) {
  if (response.status !== 503 || body.ok !== false || body.error !== "Football fixtures temporarily unavailable") throw new Error(`Expected controlled 503 outage response, received ${response.status}`);
  if (JSON.stringify(stats) !== JSON.stringify(before)) throw new Error("Database outage consumed a mock-provider request");
  console.log(JSON.stringify({ ok: true, status: response.status, providerRequestsAdded: 0, response: body }, null, 2));
} else {
  if (!response.ok || body.count !== 1 || body.fixtures?.[0]?.id !== 990001) throw new Error("Restarted application did not return the persisted synthetic fixture");
const providerRequests = Object.values(stats.requests ?? {}).reduce((sum, value) => sum + Number(value), 0);
const maximum = Number(process.env.MARIADB_LOAD_MAX_PROVIDER_REQUESTS ?? 1);
if (providerRequests > maximum) throw new Error(`Persistence restart caused ${providerRequests} mock-provider requests; maximum is ${maximum}`);
console.log(JSON.stringify({ ok: true, fixtureId: body.fixtures[0].id, providerRequests, maximum, stats }, null, 2));
}
