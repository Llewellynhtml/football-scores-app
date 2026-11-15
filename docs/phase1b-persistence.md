# Phase 1B persistence rollout

This PR is stacked on Phase 1 PR #1. Do not merge it independently until #1 is reviewed.

## Assumptions and prerequisites
The repository contains a Supabase client, but that does **not** prove that a Supabase database is provisioned, migrated, or accessible from Hostinger. No database changes are applied by this PR.

1. Confirm the intended Supabase project, region, quota and API-Football licensing rights to store/reuse data.
2. Run `supabase/migrations/20261115_phase1b_football_cache.sql` in that project's SQL editor after review.
3. Configure server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Hostinger. Never use a NEXT_PUBLIC_ prefix for the service key.
4. Set `FOOTBALL_PERSISTENCE_ENABLED=true` only after the migration and access checks.
5. Verify repeated requests share cached results and usage counts survive process restarts.
6. Rotate credentials immediately if accidentally committed.

## Failure semantics
- With persistence disabled or missing credentials, Next.js cache and process-local counters remain in use.
- When persistence is enabled, database read failures are logged and the provider is used; write failures are logged.
- Stale cache may be used only when a provider request fails, and only within the stale window.
- This implementation does not provide distributed locking or a quota reservation mechanism; add those before high-concurrency production traffic.
- The durable counter is best effort; the provider's own quota headers/dashboard remain authoritative.
- Provider request failures without a response are recorded as status 0.
- Cache rows should be periodically deleted after stale_until and usage history retained according to policy.

## Rollback
Disable `FOOTBALL_PERSISTENCE_ENABLED` and restart the app. Leave tables in place until operational review; dropping them destroys stored data and audit history.
