# Football Scores App

Private Next.js + TypeScript football portal prepared for Hostinger Node.js hosting.

## Implemented

- Yesterday / Today / Tomorrow date navigation
- Competition filters
- Featured EPL, Champions League, La Liga and South African PSL configuration
- Match detail pages
- League fixture pages
- League standings
- Team pages
- SEO-friendly slugs
- API-Football server-side integration
- Cached provider requests
- API usage/rate-limit snapshot endpoint
- Health endpoint
- Protected cron cache-warming endpoint
- GitHub Actions build validation
- No API key committed to GitHub

## Main routes

- `/`
- `/leagues/premier-league`
- `/standings/premier-league`
- `/teams/mamelodi-sundowns`
- `/matches/arsenal-vs-chelsea-12345`
- `/api/health`
- `/api/usage`

## Environment variables

Copy `.env.example` to `.env.local` for local development.

Required in Hostinger:

```
API_FOOTBALL_KEY=your_real_key
CRON_SECRET=a_long_random_secret
SITE_URL=https://plum-trout-603701.hostingersite.com
```

Optional:

```
FOOTBALL_SEASON=2026
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
CRON_MODE=fixtures
```

Never commit the real API key or cron secret.

## Local development

```
npm install
npm run dev
```

## Hostinger build

- Node.js: 22.x
- Build command: `npm run build`
- Start command: `npm start`

## Cron warming

The protected route supports:

- `mode=fixtures` — warms today's fixture cache with one fixture query
- `mode=standings` — warms the four featured league tables

The included script can be run by Hostinger cron:

```
npm run cron:warm
```

Use the fixtures job conservatively on the free API-Football plan. Run standings much less frequently because one standings warm-up can require four provider requests.

Hostinger cron schedules use UTC, so convert your desired South African time to UTC when scheduling.

## API quota protection

The application reduces provider calls through Next.js server caching. `/api/usage` exposes the latest provider limit/remaining headers seen by the current Node.js process plus a process-local outbound call count. This is useful for diagnostics but is not yet a persistent multi-process billing ledger; a database-backed quota ledger can be added before higher traffic.
