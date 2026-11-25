# API-Football v3.9.3 compliance and endpoint audit

Audit date: 2026-11-24. Scope: local `feat/phase1b-persistent-football-cache` working tree. No provider call, migration, deployment, commit or push was performed.

## Authoritative documentation reviewed

- [API-Football v3.9.3 documentation](https://www.api-football.com/documentation-v3)
- [Pricing and daily quotas](https://www.api-football.com/pricing)
- [Daily/per-minute rate-limit behavior and four headers](https://www.api-football.com/news/post/how-ratelimit-works)
- [Coverage, batching and quota optimization](https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage)
- [League-season workflow and enriched fixtures](https://www.api-football.com/news/post/how-to-get-all-data-from-a-league-with-api-football)
- [Shared outbound-IP risks](https://www.api-football.com/news/post/avoid-rate-limit-and-suspension-issues-with-shared-ips)
- [Terms and licensing restrictions](https://www.api-football.com/terms)

Documentation statements are provider guidance, not service guarantees. Coverage flags can change and a true flag does not guarantee every fixture has data. Pricing and limits must be rechecked before production.

## Executive compliance result

High-priority fixes implemented locally:

- Typed envelope parsing preserves `get`, `parameters`, `errors`, `results`, `paging` and array-or-object `response` contracts. Empty results remain distinct from provider errors.
- All four official daily/per-minute headers are captured. Local and database quota guards now enforce both windows with essential reserves.
- `/status` reconciliation is available only through the already authenticated usage route using `?reconcile=true`; account identity is discarded. The status call is tracked separately and is not represented as a quota-consuming data attempt, consistent with the documentation.
- Fixture ID batches are deduplicated, sorted and capped at 20. They remain disabled until subscription capability is explicitly verified.
- All documented fixture status codes have an explicit application classification.
- Cache policy covers implemented and deferred datasets, and historical fixture dates receive longer policies.
- Known plan/season/date provider errors temporarily suppress identical requests to prevent repeated quota waste.

Production remains **NO-GO** until development migration validation, credential rotation and two-instance integration testing are complete.

## Endpoint implementation register

All data endpoints use `x-apisports-key`; plans currently list all endpoints, while Free limits available seasons. “Coverage” below means the selected league-season coverage flag where one exists. Pagination metadata is preserved by the provider parser, but ordinary page requests do not bulk-page.

| Official endpoint | Status | Application function / parameters | Response and pagination | Coverage / plan notes | Cache policy / accounting | App route and tests / gap |
|---|---|---|---|---|---|---|
| `/status` | Implemented, protected | `reconcileProviderStatus()`; no query | Object; no paging | Documented as not counting against daily quota; contains account data | `no-store`; deliberately excluded from data-attempt counter | `/api/usage?reconcile=true`, bearer protected; sanitized summary only |
| `/timezone` | Not implemented | — | Array; no paging | No league coverage | Proposed 30d | Visitor presentation uses browser IANA zone; provider list deferred |
| `/countries` | Not implemented | — | Array; no paging | Stable reference data | Proposed 7d + 30d stale | Deferred normalized reference import |
| `/leagues` | Implemented | `getFootballLeagueCatalog()` with `current=true`; `resolveLeague()` | Array; no paging | Returns season-specific coverage; Free seasons limited | 24h + 7d stale; counted/deduplicated | Used by league pages and cron catalog; mapper tests remain desirable |
| `/leagues/seasons` | Not implemented | — | Array; no paging | Global season keys | Proposed 24h | League metadata already supplies seasons needed by current UI |
| `/teams` | Implemented | league+season, search; `getLeagueTeams`, `searchTeams`, `getTeamBySlug` | Array; no paging | At least one parameter; stable provider team ID | 12h + 3d stale | Team/league routes; search validation is implemented |
| `/teams/statistics` | Not implemented | — | Object; no paging | League+season+team; coverage/data varies | Proposed 12h + 1d stale | Deliberately deferred; object contract now supported by parser |
| `/teams/seasons` | Not implemented | — | Array | Team ID | Proposed 24h | Deferred |
| `/teams/countries` | Not implemented | — | Array | Reference data | Proposed 7d | Deferred |
| `/venues` | Partially implemented | Venue fields embedded in `/teams` and `/fixtures`; no direct call | Array direct endpoint | No coverage flag | Embedded cache policies | Standalone venue search deferred |
| `/standings` | Implemented | league+season; `getStandings()` | Array containing one or more standings groups | Requires `coverage.standings` | 30m + 6h stale; counted | League/standings routes; all groups are flattened today, so group identity is preserved per row but group-level structure is not |
| `/fixtures/rounds` | Not implemented | — | String array; optional dates | League+season | Proposed 6h + 1d | Deferred stage navigation |
| `/fixtures` date | Implemented | date+UTC timezone; `getFixturesByDate()` | Fixture array | Free season/date capability checked locally where configured | Current 60s+120s; Free 15m+1h; historical 6h+7d | Homepage and `/api/fixtures`; deterministic mocks |
| `/fixtures` ID | Implemented | id; `getFixtureById()` | Enriched fixture array containing events, lineups, team/player statistics | Detail availability follows coverage/fixture | 60s+120s current; 15m+1h Free | Match-centre page; prevents four-detail N+1 |
| `/fixtures` IDs | Implemented but disabled pending verification | normalized `ids=ID-ID`, max 20; `getFixturesByIds()` | Enriched fixture array | Provider documents up to 20; deployment flag required | Same detail policy; one counted attempt | Unit-tested normalization; no automatic bulk import |
| `/fixtures` live | Deliberately deferred ingestion | Policy supports `live=all`; no active caller | Fixture array with embedded events | Livescore availability varies | 20s + 60s stale; proposed central scheduler | No per-visitor live polling or scheduled job activated |
| `/fixtures/headtohead` | Not implemented | — | Fixture array | No dedicated coverage flag | Proposed 1m live / 1d otherwise | Deferred feature |
| `/fixtures/statistics` | Partially implemented via enriched fixture | No separate caller | Array | `coverage.fixtures.statistics_fixtures` | Registry 1m + 5m | Embedded data reused in match centre; direct filters/half deferred |
| `/fixtures/events` | Partially implemented via enriched fixture/live | No separate caller | Array | `coverage.fixtures.events` | Registry 30s + 2m | Embedded data reused; direct filtered endpoint deferred |
| `/fixtures/lineups` | Partially implemented via enriched fixture | No separate caller | Array | `coverage.fixtures.lineups`; may arrive shortly before kickoff | Registry 2m + 10m | Embedded data reused; direct endpoint deferred |
| `/fixtures/players` | Partially implemented via enriched fixture | No separate caller | Array | `coverage.fixtures.statistics_players` | Registry 1m + 5m | Nullable stats remain null; direct endpoint deferred |
| `/injuries` | Not implemented | — | Array; supports up to 20 fixture IDs | `coverage.injuries`; season needed with league/team/player | 4h + 12h stale | Deferred; registry present |
| `/predictions` | Not implemented | — | Array | `coverage.predictions` | 1h + 3h stale | Deferred; must not be presented as certainty |
| `/coachs` | Not implemented | — | Array | No league coverage flag | Proposed 1d + 7d | Deferred |
| `/players/seasons` | Not implemented | — | Array | Player ID | Proposed 1d | Deferred |
| `/players/profiles` | Not implemented | — | Array; 250/page | No league coverage flag | Proposed 7d + 30d | Bounded explicit pagination required before implementation |
| `/players` | Not implemented | — | Array; 20/page | `coverage.players`; season plus ID/league/team rules | Registry 12h + 3d | No partial dataset is exposed as complete |
| `/players/squads` | Not implemented | — | Array | Team or player required | Proposed 7d | Deferred |
| `/players/teams` | Not implemented | — | Array | Player required | Proposed 7d | Deferred |
| `/players/topscorers` | Not implemented | — | Top 20 array | `coverage.top_scorers` | Proposed 6h | Deferred |
| `/players/topassists` | Not implemented | — | Top 20 array | `coverage.top_assists` | Proposed 6h | Deferred |
| `/players/topyellowcards` | Not implemented | — | Top 20 array | `coverage.top_cards` | Proposed 6h | Deferred |
| `/players/topredcards` | Not implemented | — | Top 20 array | `coverage.top_cards` | Proposed 6h | Deferred |
| `/transfers` | Not implemented | — | Array | Player or team filter | 1d + 7d stale | Deferred |
| `/trophies` | Not implemented | — | Array; supports player/coach batches | No coverage flag | Proposed 7d | Deferred |
| `/sidelined` | Not implemented | — | Array; supports player/coach batches | No coverage flag | Proposed 1d | Deferred |
| `/odds/live` | Not implemented | — | Array, rapidly changing | `coverage.odds`; no history | 15s + 30s stale maximum | Deliberately deferred due quota/licensing/product scope |
| `/odds/live/bets` | Not implemented | — | Array | Reference list | Proposed 1h | Deferred |
| `/odds` | Not implemented | — | Array; 10/page | `coverage.odds`; documented time/history window | 3h + 3h stale | Deferred; bounded explicit pagination required |
| `/odds/mapping` | Not implemented | — | Array; 100/page | Odds availability mapping | Proposed 1d | Deferred |
| `/odds/bookmakers` | Not implemented | — | Array | Reference list | Proposed 7d | Deferred |
| `/odds/bets` | Not implemented | — | Array | Reference list | Proposed 7d | Deferred |

Media URLs under `media.api-sports.io` are loaded by the browser and are not API data endpoint attempts. They may have separate CDN/network behavior and licensing obligations.

## Defects and fixes by priority

### P0 — production gates

1. Rotate credentials previously exposed in screenshots; update Hostinger/local secrets and revoke old values.
2. Review/apply the three migrations only to `football-scores-dev`, run transactional validation, and confirm no `anon`, `authenticated` or `PUBLIC` privileged RPC execution.
3. Run two-instance lease/quota integration tests with mocked provider traffic.

### P1 — fixed locally

- Missing per-minute limiter and two official minute headers.
- Array-only envelope assumptions and loss of paging metadata.
- Ad-hoc status sets that omitted postponed/cancelled/abandoned/administrative states.
- Fixture batch normalization/capability gating.
- Repeated identical plan-restricted calls.
- Unsafe exposure risk from raw `/status` account fields.

### P2 — roadmap

- Preserve standings groups as first-class group/stage objects rather than only flattened rows.
- Add a server-selected visitor date/timezone flow that fetches the one or two overlapping UTC dates and combines them by canonical timestamp. The UTC conversion helper is implemented and DST/year tested; UI routing is deferred to avoid unrelated redesign.
- Add a coverage registry persisted per league-season, with refresh timestamps and feature-specific “unsupported” versus “temporarily empty” states.
- Add explicit paginated result types before players/odds are introduced.

## Rate-limit and quota architecture

Every actual data attempt receives a UUID. Before sending, the app reserves both daily and rolling-minute capacity atomically in Postgres. Essential fixture requests can use configured reserves; nonessential work stops sooner. A process-local rolling-minute fallback remains active when persistence is disabled. Four provider headers update diagnostics and only newer observations replace quota snapshots. Provider HTTP 429 creates a bounded cooldown. Provider plan errors, JSON errors, network failures and timeouts remain distinct outcomes.

The `/status` reconciler is manually triggered through the protected usage route and returns plan/activity/aggregate consumption only. It never returns name or email. Local attempts are not claimed as provider-billed usage; response headers, `/status` and the provider dashboard are authoritative. Shared-IP network protection can produce 429 responses even when key quota remains.

## Usage budgets

Current official published limits must be rechecked before deployment:

| Plan | Published daily | Published minute | Suggested application reserve | Practical note |
|---|---:|---:|---:|---|
| Free | 100/day | 10/min | 10/day, 2/min | A 24-hour once-per-minute live feed would require 1,440 calls and is impossible. Limit central live windows, prioritize fixture details, and rely heavily on shared cache. |
| Ultra | 75,000/day | 450/min (7/sec operational guidance) | Configure from traffic/SLA; do not hardcode | Central ingestion is feasible, but spread calls and retain batching/deduplication. |

Example Free soft budget: 10 league/coverage refreshes, 20 scheduled-date/detail refreshes, up to 60 centralized live-window calls, 10-call emergency reserve. This is an operational example, not provider accounting. Ultra limits remain environment configuration.

## Central live-score design

Proposed, not activated: a Hostinger-supported scheduled request calls one authenticated ingestion endpoint. It fetches `/fixtures?live=all`, stores the shared result and embedded events, then schedules the next eligible run based on active statuses, provider minute headers and remaining daily budget. With no live fixtures it backs off to scheduled-fixture policies. Visitors read shared cache only. Confirm Hostinger cron minimum frequency and execution limits before activation; do not assume a permanent worker.

## Normalized database proposal

Keep raw-response cache for request deduplication, then add normalized storage in phases rather than one migration:

1. Reference phase: `football_countries(provider_code unique)`, `football_leagues(provider_league_id unique)`, `football_league_seasons(league_id, season_year unique)`, and `football_competition_coverage(league_season_id unique, coverage jsonb, observed_at)`.
2. Fixture phase: teams and venues keyed by stable provider IDs; fixtures with unique provider fixture ID, UTC kickoff, status and league-season FKs; match-detail tables keyed by fixture ID and detail type/version.
3. Table/player phase: standings keyed by league-season/group/team/update; players keyed by provider ID; player-team-season relationships.

Use nullable source fields, ingestion timestamps and source-version metadata. Retention must follow API-Football licensing and product needs; do not infer that subscription permits resale, indefinite republication, or unrestricted logo/photo use. No normalized migration is included in this scope.

## Hosting, security and licensing

Verify Hostinger egress from the deployed runtime by asking Hostinger support whether outbound IP is dedicated/static and, during an approved maintenance test, comparing repeated outbound-IP checks from the app host. Do not expose an IP-check or arbitrary-forwarding public route. If shared-IP protection becomes material, use an authenticated allowlisted egress service accepting only fixed API-Football paths and stripping caller-supplied headers; never build an open proxy. No infrastructure was provisioned.

API keys remain server-only. Cron/usage routes fail closed. Inputs are normalized/bounded, errors returned publicly are sanitized, and logs must never contain keys or raw account status. The terms prohibit direct data resale and require account security; confirm commercial publication, retention, logo and player-photo rights with the provider or rights holders.

## Configuration

In addition to Phase 1C variables:

```env
FOOTBALL_PER_MINUTE_REQUEST_LIMIT=10
FOOTBALL_PER_MINUTE_RESERVE=2
API_FOOTBALL_FIXTURE_BATCHING_ENABLED=false
```

Set fallbacks to the subscribed plan only after checking the dashboard/current documentation. Provider headers can lower effective scheduling; they must not silently raise configured safety limits without operational review.

## Migration, rollback and validation

Migration order and rollback remain as documented in `docs/phase1b-persistence.md`. The Phase 1C migration now adds minute snapshot fields and applies daily plus rolling-minute reservations. Run `supabase/validation/20261124_phase1c_validation.sql` transactionally after manual development application. Application rollback is `FOOTBALL_PERSISTENCE_ENABLED=false`; retain tables unless destructive removal is separately approved.

## Remaining roadmap and assessment

Next milestones: development SQL validation; coverage registry; grouped standings model; visitor-selected date/timezone routing; central live ingestion proof-of-concept; explicit pagination service; normalized reference/fixture migrations; Hostinger egress verification; browser hydration tests.

**Production assessment: NO-GO.** Local compliance is materially improved, but credential rotation, development database validation, external-plan verification and multi-instance integration remain mandatory review gates.
