# Live Sports App

A private Next.js + TypeScript multi-sport scores platform deployed on Hostinger and designed for a worldwide audience.

## API-driven sports data

Football does not maintain local lists of leagues, league IDs, countries, seasons, teams, team IDs or logos.

API-Football is the source of truth for:

- current leagues and cups
- competition IDs, names, countries and logos
- current season and coverage flags
- fixtures, results and match status
- standings
- teams and team profiles

The football homepage derives competition filters from API responses. The league directory is generated from API-Football and cached server-side.

## Worldwide timezone model

Sports providers are queried using UTC as the canonical source timezone. Browser-facing kickoff times, match dates and update timestamps are converted to the visitor's local timezone with the JavaScript Internationalization API. A visitor's location never limits which countries, leagues, teams or sports are available.

## Football data modes

The project supports two football data modes:

- `API_FOOTBALL_DATA_MODE=free` — development mode for the Free API-Football plan. It selects `API_FOOTBALL_FREE_SEASON` (default `2024`) from each league's API-provided season catalogue and clearly labels the site as historical development data.
- `API_FOOTBALL_DATA_MODE=current` — production/current-season mode for an upgraded API plan. It selects the season marked current by API-Football.

The season fallback is application configuration only. League IDs, names, season objects, fixtures, standings and other sports facts still come from API-Football.

## Application configuration

Provider URLs, environment-variable names, route patterns, cache durations, status mappings, UI labels and timezone settings are application configuration. They are not sports-result or competition data.

## Main routes

- `/` — football scores for the selected date
- `/leagues` — API-driven football league/cup catalogue
- `/leagues/[league]` — API-driven competition fixtures
- `/standings/[league]` — API-driven standings when covered
- `/teams` — API-Football team search
- `/teams/[slug]` — API-resolved team profile
- `/matches/[slug]` — match detail
- `/sports` — supported sport modules
- `/api/usage` — API usage diagnostics

## Environment variables

Copy `.env.example` and configure deployment values in Hostinger. Do not commit real API keys or cron secrets.

`SITE_URL` should be set to the production origin. Keep provider timestamps in UTC. When the API plan is upgraded, change `API_FOOTBALL_DATA_MODE` from `free` to `current`; no page rewrite is required.

## Hostinger

- Node.js: 22.x
- Build command: `npm run build`
- Start command: `npm start`
- Output: Next.js `.next`

## Quota strategy

API responses are cached server-side. Catalogue and metadata use longer cache durations than score feeds. Expensive league data is fetched on demand instead of preloading every competition.
