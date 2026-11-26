import http from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.MOCK_API_FOOTBALL_PORT ?? 4310);
const delayMs = Number(process.env.MOCK_API_FOOTBALL_DELAY_MS ?? 150);
const counters = new Map();

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", "x-football-synthetic": "true", ...headers });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname === "/__health") {
    send(response, 200, { ok: true, service: "mock-api-football" });
    return;
  }
  if (url.pathname === "/__stats") {
    send(response, 200, { requests: Object.fromEntries(counters) });
    return;
  }
  if (url.pathname === "/__reset" && request.method === "POST") {
    counters.clear();
    send(response, 200, { ok: true });
    return;
  }
  if (request.headers["x-apisports-key"] !== "integration-test-key") {
    send(response, 401, { errors: { token: "invalid" }, results: 0, response: [] });
    return;
  }
  const key = `${url.pathname}?${[...url.searchParams].sort().map(([name, value]) => `${name}=${value}`).join("&")}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (process.env.MOCK_API_FOOTBALL_FAILURE === "429") {
    send(response, 429, { errors: { rateLimit: "mock minute limit" }, results: 0, response: [] });
    return;
  }
  if (process.env.MOCK_API_FOOTBALL_FAILURE === "500") {
    send(response, 503, { errors: { upstream: "mock outage" }, results: 0, response: [] });
    return;
  }
  const headers = {
    "x-ratelimit-requests-limit": "100",
    "x-ratelimit-requests-remaining": "99",
    "x-ratelimit-limit": "10",
    "x-ratelimit-remaining": "9",
  };
  if (url.pathname === "/status") {
    send(response, 200, { get: "status", parameters: [], errors: [], results: 1, response: {
      account: { firstname: "Never", lastname: "Expose", email: "redacted@example.invalid" },
      subscription: { plan: "Integration", end: "2099-01-01T00:00:00Z", active: true },
      requests: { current: 1, limit_day: 100 },
    } }, headers);
    return;
  }
  if (url.pathname === "/fixtures") {
    const date = url.searchParams.get("date") ?? "2026-11-25";
    const fixture = {
      fixture: {
        id: 990001,
        date: `${date}T18:00:00+00:00`,
        referee: "CI Referee",
        timezone: "UTC",
        timestamp: Math.floor(Date.parse(`${date}T18:00:00Z`) / 1000),
        periods: { first: null, second: null },
        venue: { name: "CI Stadium", city: "Test City" },
        status: { long: "Not Started", short: "NS", elapsed: null, extra: null },
      },
      league: { id: 990, name: "CI League", country: "Test", logo: "https://example.invalid/league.png", flag: null, season: 2026, round: "CI Round" },
      teams: {
        home: { id: 991, name: "CI Home", logo: "https://example.invalid/home.png", winner: null },
        away: { id: 992, name: "CI Away", logo: "https://example.invalid/away.png", winner: null },
      },
      goals: { home: null, away: null },
      score: {
        halftime: { home: null, away: null }, fulltime: { home: null, away: null },
        extratime: { home: null, away: null }, penalty: { home: null, away: null },
      },
    };
    send(response, 200, { get: "fixtures", parameters: Object.fromEntries(url.searchParams), errors: [], results: 1, paging: { current: 1, total: 1 }, response: [fixture] }, headers);
    return;
  }
  send(response, 200, { get: url.pathname.slice(1), parameters: Object.fromEntries(url.searchParams), errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] }, headers);
});

server.listen(port, host, () => {
  console.log(`Mock API-Football listening on http://${host}:${port}`);
});
