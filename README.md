# Live Sports App

A private Next.js + TypeScript multi-sport scores platform deployed on Hostinger.

## API-driven sports data

Football does not maintain local lists of leagues, league IDs, countries, seasons, teams, team IDs or logos.

API-Football is the source of truth for:

- current leagues and cups
- competition IDs, names, countries and logos
- current season and coverage flags
- fixtures, results and match status
- standings
- teams and team profiles

The football homepage derives competition filters from the fixtures returned for the selected date. The league directory is generated from the API-Football current competition catalogue and cached server-side.

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

`SITE_URL` should be set to the production origin. Football season is not fixed locally; league season data comes from API-Football.

## Hostinger

- Node.js: 22.x
- Build command: `npm run build`
- Start command: `npm start`
- Output: Next.js `.next`

## Quota strategy

API responses are cached server-side. Catalogue and metadata use longer cache durations than score feeds. Expensive league data is fetched on demand instead of preloading every competition.
