# Live Sports App

A private Next.js + TypeScript multi-sport scores platform deployed on Hostinger. Football is the first active sport module; the architecture now registers the additional API-Sports products visible in the user's dashboard without consuming their quotas until each provider is explicitly implemented.

## Live architecture

```
Next.js platform
├── shared sports registry
├── shared navigation / SEO shell
├── Football provider (LIVE)
├── Basketball (registered)
├── NBA (registered)
├── American Football / NFL (registered)
├── Rugby (registered)
├── Formula 1 (registered)
├── Baseball (registered)
├── Hockey (registered)
├── MMA (registered)
├── Volleyball (registered)
├── Handball (registered)
└── AFL (registered)
```

"Registered" means the sport has a route, environment-variable contract and provider slot. It does not make API calls yet.

## Current football product

- Yesterday / Today / Tomorrow navigation
- Competition filters
- EPL, Champions League, La Liga and South African PSL
- Match detail pages
- League fixtures
- Standings
- Team pages
- SEO-friendly slugs
- Cached API-Football requests
- API usage diagnostics
- Protected Hostinger cron cache warming

## Multi-sport routes

- `/sports` — all registered sports
- `/sports/basketball`
- `/sports/nba`
- `/sports/american-football`
- `/sports/rugby`
- `/sports/formula-1`
- `/sports/baseball`
- `/sports/hockey`
- `/sports/mma`
- `/sports/volleyball`
- `/sports/handball`
- `/sports/afl`
- `/api/sports` — safe configuration/status view

Football remains live at `/` and `/football` redirects there so existing URLs do not break.

## Football routes

- `/`
- `/leagues/premier-league`
- `/standings/premier-league`
- `/teams/mamelodi-sundowns`
- `/matches/arsenal-vs-chelsea-12345`
- `/api/health`
- `/api/usage`

## Environment variables

The live deployment currently requires:

```
API_FOOTBALL_KEY=your_real_key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
FOOTBALL_SEASON=2026
CRON_SECRET=a_long_random_secret
SITE_URL=https://palegoldenrod-clam-775783.hostingersite.com
CRON_MODE=fixtures
```

The repository's `.env.example` contains reserved variables for the other sports. Do not add those API keys to Hostinger until we actually implement and test the corresponding provider, otherwise it becomes difficult to distinguish "configured" from "production ready."

Never commit real API keys or cron secrets.

## Hostinger

- Node.js: 22.x
- Build command: `npm run build`
- Start command: `npm start`
- Output: Next.js `.next`

## Quota strategy

Only Football consumes API-Sports quota today. Additional sports are navigation/architecture placeholders and make zero provider calls. Each new sport should receive its own cache policy, cron budget and usage tracking before activation.
