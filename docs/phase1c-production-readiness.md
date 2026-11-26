# Phase 1C implementation report

## Executive summary and recommendation

Phase 1C is implemented locally without applying migrations, contacting API-Football, changing either pull request, committing, pushing, deploying, or touching a Supabase project. It adds database leases, owner-protected cache writes, atomic quota reservations, idempotent usage events, bounded retries, plan-aware date validation, explicit cache policies, safe diagnostics, a stable test runner and stronger CI.

**Recommendation: NO-GO for production until the Phase 1C migration is reviewed and tested in `football-scores-dev`, credentials exposed in prior screenshots are rotated, and a manual integration test confirms the deployed Supabase RPC signatures.** After those gates and the checklist below pass, the code is suitable for a controlled production rollout.

## Initial audit findings

- The working branch was `feat/phase1b-persistent-football-cache` with uncommitted Phase 1B work; it was preserved.
- Process-local in-flight deduplication could not coordinate multiple Hostinger instances.
- Durable counters had no attempt identifier, so retries could double-count; quota snapshots had no observation ordering.
- Cache validation correctly rejected malformed/fully expired rows, but cache TTLs were endpoint-coarse.
- Free mode replaced the current calendar year with a configured season, conflating fixture date and competition season.
- Privileged Phase 1B RPCs were restricted to `service_role`, used an empty `search_path`, and RLS remained enabled. Cleanup was bounded but returned one count and did not cover leases.
- The usage and cron endpoints require `CRON_SECRET`; public health responses expose only booleans. No cache-maintenance endpoint was needed.
- The test command relied on Node's experimental type stripping; CI used `npm install` and omitted audit/diff checks.
- Turbopack root was implicit, allowing an unrelated parent lockfile warning.

## Architecture decisions and trade-offs

Postgres time-limited leases were chosen over session advisory locks because Supabase RPC calls do not preserve a database session. Redis would add an external service and is deferred until traffic justifies it. Waiters use bounded polling and eligible stale data; database failure intentionally degrades to local deduplication. This favors availability but cannot guarantee global deduplication during a database outage.

Quota accounting uses one lifecycle row per UUID (`RESERVED`, `DISPATCHED`, `FINALISED`, `UNKNOWN_OUTCOME`, `CANCELLED`, `RECONCILED`) and a stable quota-scope transaction lock shared by reservation, dispatch and finalisation. Only never-dispatched reservations expire harmlessly; dispatched crashes remain conservatively accounted for in their UTC windows. The provider remains authoritative because endpoints/plans may account differently and database state may lag. HTTP 429 establishes a bounded process-local cooldown; it expires automatically.

Usage events use UUID attempt IDs and original UTC timestamps. Database retries are idempotent. The retry queue is bounded process memory, not a durable outbox; process termination can lose events. A durable outbox or managed queue is warranted when usage accounting becomes billing-critical.

## Implemented changes

- Distributed lease acquisition, contention waiting, expired-owner recovery, ownership-validated release and lease-owner cache writes.
- Atomic cross-instance quota reservation, essential fixture reserve, 429 cooldown and stale fallback.
- Idempotent outcome recording for success, HTTP/provider/JSON/network/timeout failures and monotonic quota observations.
- Bounded usage retry queue with exponential backoff/jitter diagnostics.
- Endpoint-specific TTL/stale policies and strict payload/timestamp validation.
- Fixture dates remain UTC calendar dates; competition season selection is separate; optional free-plan date bounds reject known unsupported dates.
- Preferred Supabase publishable/secret key names with backward-compatible aliases.
- Portable Turbopack root derived from `next.config.ts` itself.
- `tsx` test runner, expanded deterministic mocks, and CI `npm ci`, audit and whitespace checks.
- Public health output distinguishes configuration from verified connectivity; protected usage output includes safe operational counters.

## Cache policy

| Data | Fresh TTL | Stale fallback |
|---|---:|---:|
| Live fixtures | 20s | 60s |
| Current fixture date/detail | 60s | 120s |
| Free-mode fixture date/detail | 15m | 1h |
| Events | 30s | 2m |
| Lineups | 2m | 10m |
| Fixture/player statistics | 1m | 5m |
| Standings | 30m | 6h |
| Leagues | 24h | 7d |
| Teams/players | 12h | 3d |

Stale data is served only inside `stale_until`. Provider errors are not written. Live data therefore cannot remain stale indefinitely.

## Security audit

Service credentials remain in server-only modules and accept `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`; neither may use `NEXT_PUBLIC_`. RPC functions use `SECURITY DEFINER`, an empty explicit `search_path`, input bounds, RLS and revoked `PUBLIC`/`anon`/`authenticated` execution. Cron and usage endpoints fail closed when the shared secret is missing. Health output contains no URLs, keys or raw database errors. `.env*`, `.next`, `node_modules` and `*.tsbuildinfo` remain ignored.

Remaining security gates are credential rotation and executing the supplied grant/RLS validation in development. Secrets were not printed or transmitted during this work.

## Environment changes

Required for persistence: `SUPABASE_URL`, preferred `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` accepted), and `FOOTBALL_PERSISTENCE_ENABLED=true` only after migrations. Optional browser/server client key: preferred `SUPABASE_PUBLISHABLE_KEY` (legacy anon aliases accepted).

Quota: `FOOTBALL_QUOTA_GUARD_ENABLED`, `FOOTBALL_DAILY_REQUEST_LIMIT`, `FOOTBALL_QUOTA_RESERVE`, `FOOTBALL_PER_MINUTE_REQUEST_LIMIT`, `FOOTBALL_PER_MINUTE_RESERVE`, `FOOTBALL_QUOTA_COOLDOWN_SECONDS`. Retry queue: `FOOTBALL_USAGE_QUEUE_MAX`, `FOOTBALL_USAGE_RETRY_MAX`. Plan window: `API_FOOTBALL_FREE_DATE_FROM`, `API_FOOTBALL_FREE_DATE_TO`. `API_FOOTBALL_FREE_SEASON` now means competition season only and may be omitted in favor of returned league metadata.

## Migration and rollback

Apply manually to `football-scores-dev` only, in order:

1. `20261115_phase1b_football_cache.sql`
2. `20261124_phase1b_usage_and_cache_maintenance.sql`
3. `20261124_phase1c_reliability_and_coordination.sql`
4. Run `supabase/validation/20261124_phase1c_validation.sql` (it rolls back its test data).

Rollback the application by disabling persistence and restarting. Keep tables for recovery/audit. Any later schema removal requires an approved backup and reverse dependency removal; it is intentionally not automated.

## Changed and added files

Configuration: `.env.example`, `.github/workflows/build.yml`, `.gitignore`, `next.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`.

Application: `src/lib/api-usage.ts`, `football-cache.ts`, `football-config.ts`, `football-persistence.ts`, `football-quota.ts`, `football-request.ts`, `football.ts`, `supabase.ts`, `usage-queue.ts`; health/database-health/usage API routes.

Tests/docs/database: existing three test files, new `phase1c.test.mjs`, both Phase 1B migrations, new Phase 1C migration, validation SQL, this report and `phase1b-persistence.md`.

## Manual development integration test

1. Rotate credentials and apply migrations only to `football-scores-dev`; run validation SQL and inspect grants.
2. Set development server-only environment values, quota limit/reserve, and `FOOTBALL_PERSISTENCE_ENABLED=true`.
3. Start two app processes on different ports. Request the same uncached fixture URL concurrently and verify one provider attempt, one cache row, lease release and matching responses.
4. Repeat for fresh, stale-eligible and fully expired rows. Simulate Supabase failure and confirm provider/local deduplication continue with a degraded-coordination log.
5. Mock provider 429 and timeout responses; confirm no immediate repeat, stale fallback where eligible, distinct counters, and automatic recovery after cooldown/reset.
6. Verify `/api/usage` and cron reject missing/invalid bearer tokens. Confirm public health exposes booleans only.
7. Invoke bounded cleanup manually with a small limit and confirm only fully expired rows/leases are removed.

## Limitations and residual risk

- The memory retry queue loses events on process exit; provider metrics remain authoritative.
- Cross-instance deduplication and atomic quota reservations degrade during Supabase outages.
- Provider plan date windows are configuration-driven because API-Football does not expose a single stable capability contract for every plan.
- Automated tests mock Supabase; the supplied transactional SQL and two-process integration test are still mandatory.
- No browser/hydration test was performed in this phase.
