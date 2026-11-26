# Phase 1B persistence rollout

This PR is stacked on Phase 1 PR #1. Do not merge it independently until #1 is reviewed.

## Assumptions and prerequisites
The repository contains a Supabase client, but that does **not** prove that a Supabase database is provisioned, migrated, or accessible from Hostinger. No database changes are applied by this PR.

1. Confirm the intended Supabase project, region, quota and API-Football licensing rights to store/reuse data.
2. Review and manually run `supabase/migrations/20261115_phase1b_football_cache.sql`, `supabase/migrations/20261124_phase1b_usage_and_cache_maintenance.sql`, then `supabase/migrations/20261124_phase1c_reliability_and_coordination.sql`, in that order and only in `football-scores-dev` first.
3. Configure server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Hostinger. `SUPABASE_SERVICE_ROLE_KEY` remains a compatible alias. Never use a `NEXT_PUBLIC_` prefix for either secret-key name.
4. Set `FOOTBALL_PERSISTENCE_ENABLED=true` only after the migration and access checks.
5. Verify repeated requests share cached results and usage counts survive process restarts.
6. Rotate credentials immediately if accidentally committed.

## Failure semantics
- With persistence disabled or missing credentials, Next.js fetch caching and process-local counters remain in use. With persistence enabled and configured, provider fetches use `no-store`; Supabase is authoritative.
- When persistence is enabled, database read failures are logged and the provider is used; write failures are logged.
- Stale cache may be used only after a provider failure and strictly before `stale_until`. Live/current fixtures get at most 120 seconds of stale grace, other fixture data 15 minutes, and static data at most 24 hours.
- In-flight deduplication is retained per process. Phase 1C adds atomic, expiring database leases for cross-instance coordination. Waiters poll for at most 2.5 seconds and may use eligible stale data. A lease owner rechecks the cache; owner-validated writes prevent an expired owner overwriting a newer response. Database outages degrade this guarantee to process-local deduplication and provider access.
- Durable attempts have UUID identifiers and preserve their original UTC timestamps. Repeated database writes are idempotent. A bounded process-memory queue retries temporary failures with exponential backoff and jitter; it is not durable and queued events are lost on process exit. Provider quota values are updated only by newer observations. The provider dashboard and response headers remain authoritative.
- HTTP failures, HTTP 200 API-level errors, network failures, and timeouts have separate counters. Durable recording is best effort and happens once per deduplicated attempt.
- The second migration provides `cleanup_expired_football_cache(limit)`. It is never called automatically; schedule or invoke it only after operational review. Each call deletes at most the requested bounded batch (maximum 5,000) where `stale_until <= now()`.

## Rollback
Disable `FOOTBALL_PERSISTENCE_ENABLED` and restart the app. Leave tables in place until operational review; dropping them destroys stored data and audit history.

## Phase 1C operating policy

Quota guard configuration is validated at runtime. Nonessential calls stop before both the configured daily and rolling-minute reserves; essential fixture requests may use those reserves. A never-dispatched reservation expires after two minutes. A dispatched attempt transitions to `UNKNOWN_OUTCOME` rather than restoring quota if the process crashes, and remains charged only to its original UTC usage day/minute window until finalised or reconciled. The application cannot guarantee provider enforcement during database outages, shared-IP network protection is independent, and provider HTTP 429 responses remain authoritative.

Fixture calendar dates are never rewritten into another year. `API_FOOTBALL_FREE_SEASON` selects a competition season only. Optional `API_FOOTBALL_FREE_DATE_FROM` and `API_FOOTBALL_FREE_DATE_TO` reject known unsupported fixture dates before provider access. Leave the season unset to select from returned league metadata; configure it only from provider plan documentation or a verified response.

Cache policy: live fixtures 20s + 60s stale; fixture date/detail 60s + 120s stale in current mode (15m + 1h in free mode); events 30s + 2m; lineups 2m + 10m; fixture/player statistics 1m + 5m; standings 30m + 6h; leagues 24h + 7d; teams/players 12h + 3d. Fully expired or malformed rows are never served, and provider errors are never cached.

Maintenance stays manual. `cleanup_expired_football_cache_bounded(limit)` deletes only rows beyond `stale_until` and expired leases, uses `SKIP LOCKED`, returns separate counts, and caps each category at 5,000. Invoke only with a service key through a reviewed server-side job; no public endpoint is provided.

## Migration validation and rollback

After applying all migrations to the development project, run `supabase/validation/20261124_phase1c_validation.sql`. It checks RLS and function grants, then tests leases, ownership, writes, idempotency and cleanup validation inside a rolled-back transaction. Confirm only `service_role` has execute privileges; `anon`, `authenticated` and `PUBLIC` must not.

Application rollback is feature-first: set `FOOTBALL_PERSISTENCE_ENABLED=false` and restart. Schema rollback should normally retain tables for audit/recovery. If removal is approved later, first archive required data, then remove Phase 1C functions before tables in reverse dependency order. Do not drop the Phase 1B cache or usage tables unless permanent data loss is explicitly approved.

## Credential rotation checklist

1. Rotate any development Supabase secret/service-role and publishable/anon keys shown in screenshots.
2. Rotate the API-Football/API-Sports key and `CRON_SECRET` if exposed.
3. Update Hostinger and local untracked environment values; never paste secrets into logs or PR comments.
4. Revoke old keys, verify health/configuration without printing values, and review Supabase/API-Football access logs.
5. Run repository secret scanning and report only file paths with redacted findings. Do not rewrite Git history automatically.
