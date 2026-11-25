# Phase 1C final implementation gap audit

Audit date: 2026-11-24. Branch: `feat/phase1b-persistent-football-cache`. This report is based on the actual working tree. No migration, live provider request, deployment, commit, push or PR action was performed.

## Readiness decisions

- **Code readiness:** ready for review. Local deterministic checks pass.
- **Development migration readiness:** conditionally ready for manual application to `football-scores-dev` after SQL peer review and a backup/export decision. Validation SQL is prepared but has not been executed against Supabase.
- **Integration readiness:** harness and procedure are prepared; not passed because no development migration or shared test database was used.
- **Production readiness:** **NO-GO**. Credential rotation, development SQL validation, two-process integration, plan capability verification and retention policy approval remain gates.

## Requirement implementation matrix

| Requirement | Status | Evidence | Finding |
|---|---|---|---|
| Actual working-tree audit | Implemented and tested | This document; `git status`; validation commands below | Existing uncommitted work was preserved. |
| Distributed cache coordination | Implemented and unit-tested; infrastructure integration untested | `src/lib/football-request.ts:45-112,194-225`; `src/lib/football-persistence.ts:50-63`; migration `:48-78` | UUID owners, atomic expiring leases, bounded wait, recheck, owner release/write, local dedupe and DB-outage degradation are real code paths. |
| Idempotent usage recording | Implemented and unit-tested; SQL unexecuted | `src/lib/football-request.ts:127-197`; `src/lib/api-usage.ts:68-109`; persistence `:78-95`; migration `:80-110` | UUID attempt IDs, original timestamps, UTC day, duplicate PK rejection and ordered quota observations are implemented. `/status` bypasses data-attempt accounting. |
| Database-outage recovery | Implemented and tested | `src/lib/usage-queue.ts:15-62`; `src/lib/football.ts:376-423` | Queue size/retries/backoff/jitter/drop metrics are bounded. Events remain lossy on process termination. |
| Distributed daily/minute quota | Phase 1D lifecycle implemented and unit/static-tested; SQL concurrency unexecuted | `src/lib/football-quota.ts`; `football-persistence.ts`; Phase 1C migration | Reservation, dispatch and finalisation share one stable quota-scope transaction lock. Never-dispatched reservations expire; dispatched crashes become `UNKNOWN_OUTCOME`. DB outage falls back to per-process protection and cannot guarantee global enforcement. |
| Provider contracts | Implemented and tested for actual array path and `/status` object path | `src/lib/football-provider-contract.ts:24-60`; requester `:145-171`; status module | HTTP/provider/JSON/shape/empty cases are distinguished. Paging is preserved by the parser but no currently implemented paginated consumer exists. Raw persistent caching remains array-only by design. |
| Competition coverage enforcement | Partially implemented | `src/lib/football.ts:766-793`; endpoint audit | Standings are suppressed when unsupported. Enriched `/fixtures?id` avoids four separate detail calls, but events/lineups/statistics availability is not yet represented as explicit unsupported-vs-not-yet-available UI state. Deferred endpoints make no requests. |
| Negative caching / capabilities | Implemented and unit-path tested; expiry timing not separately tested | requester `:48,65-72,157-166`; namespace config `src/lib/football-config.ts:32-46` | Plan/season/date restrictions are scoped by fully namespaced cache key and expire after 15 minutes. Provider origin, schema, mode, Free window/season and batching flag invalidate old decisions. Transient HTTP/network failures are not negative-cached. |
| Cache namespace compatibility | Implemented and tested | config `:32-46`; cache key `src/lib/football-cache.ts:31-34`; cache-key tests | Schema v2/provider/capability namespace safely ignores obsolete Phase 1B keys without deleting them. Parameters are normalized and hashed. |
| Fixture batching | Partially implemented / deliberately dormant | `src/lib/fixture-batching.ts`; `src/lib/football.ts:694-703`; compliance tests | IDs are deduped, sorted and capped at 20; batching is disabled until verified. Current match-detail workflow uses one enriched `/fixtures?id`, so it has no N+1. Partial-batch fallback is not activated because no batch workflow is active. |
| Dates, seasons and match states | Partially implemented and tested | config `:48-76`; `src/lib/football-timezone.ts`; `src/lib/football-status.ts`; homepage/MatchList | UTC dates are no longer rewritten; metadata selects seasons spanning years; status classification is integrated. Local-day overlap helper is DST/year tested but visitor-selected local-day routing is not yet wired into homepage/API/cron. |
| Freshness transparency | Implemented and tested at requester level | requester `:37,53-70,87-107,115-122,168-184,202-225`; fixture propagation `src/lib/football.ts:428-447,676-703`; `src/components/MatchList.tsx:70` | Fresh/stale metadata reaches fixture lists and stale rows display “Delayed data.” Persistent `updated_at` is retained. Provider-or-Next-cache cannot be distinguished when persistence is disabled, but stale is never claimed in that mode. |
| Public API abuse protection | Partially implemented | fixtures route has no caller-controlled upstream parameters; usage/cron/snapshot routes require bearer auth; input helpers bound IDs/dates | Visitors cannot choose upstream paths, batch IDs or pagination through public football routes. There is no general public per-IP throttle; current fixed-shape cached endpoint limits amplification but deployment/WAF throttling remains recommended. |
| Supabase migration safety | Implemented for review; not executed | Phase 1C migration `:1-158`; validation SQL `:3-47` | Transaction, RLS, explicit empty search paths, postgres ownership, service grants, revoked browser roles, indexes and bounded cleanup are present. Phase 1B data is altered additively. |
| Two-instance integration | Prepared, not executed | `scripts/mock-api-football.mjs`; procedure below | Controlled localhost provider exists. Requires manually migrated development/test Supabase and two independent Next processes. No real provider quota is used. |
| Performance/storage assessment | Assessed only | section below | No production payload/storage measurements were taken. Query amplification and retention gaps are documented. |
| CI/final validation | Implemented and tested locally | `.github/workflows/build.yml:20-32`; `next.config.ts:5-10`; `package.json:12-13` | `npm ci`, lint, typecheck, stable `tsx` tests, build, audit and whitespace checks are configured. Turbopack root is explicit. |
| Scope control | Deliberately deferred | endpoint audit and roadmap | Normalized database, global ingestion, player intelligence, odds/predictions, other sports and redesign remain separate phases. |

## Confirmed defects and fixes in this final audit

1. **Cache namespace was incomplete.** It isolated mode/path/parameters but not provider origin, schema or capabilities. Fixed with a schema-v2 namespace including provider origin, data mode, Free season/date bounds and fixture-batching capability. Existing cache rows are retained and safely missed.
2. **Stale state did not reach UI consumers.** The cache knew a response was stale, but fixtures lost that metadata. Fixed by propagating freshness through requester callbacks, all implemented fixture fetch paths and a minimal “Delayed data” marker.
3. **Phase 1C migration lacked an explicit transaction and ownership statements.** Fixed with `begin/commit`, explicit `postgres` function owners and explicit service-role table grants.
4. **No reproducible controlled provider process existed for two-instance verification.** Added a localhost-only mock with normalized request counters, delay and 429/503 modes.
5. **Raw connector errors could disclose infrastructure details in logs.** Cache, lease and protected usage-route failures now emit only a generic error type.

## Missing or deliberately deferred functionality

- Coverage is enforced for standings but there is no persisted league-season coverage registry or explicit unsupported/not-yet-available match-detail state.
- Batching is capability-gated and unused; partial batch completion and individual fallback remain deferred until the plan is verified and a real batch workflow exists.
- Pagination metadata is parsed, but players/odds consumers are deliberately not implemented. No partial page is represented as complete.
- Visitor-selected local calendar days are not integrated into routing; current page/API/cron use the UTC day. The overlap helper is ready for a separate UI/API phase.
- No generic public per-IP throttle is implemented. Current public football API shape has no caller-controlled provider parameters.
- API-attempt history retention/archival is not automated. Cleanup covers fully expired cache rows and leases; bounded lifecycle maintenance cancels expired `RESERVED` attempts and marks old `DISPATCHED` attempts `UNKNOWN_OUTCOME`.
- No normalized football schema or central live ingestion engine is introduced.

## Changed and added files

This audit directly added or changed:

- `src/lib/football-config.ts`, `football-cache.ts`, `football-request.ts`, `football-persistence.ts`, `football.ts`
- `src/components/MatchList.tsx`
- `src/lib/football-cache-key.test.mjs`, `football-request.test.mjs`
- `supabase/migrations/20261124_phase1c_reliability_and_coordination.sql`
- `supabase/validation/20261124_phase1c_validation.sql`
- `scripts/mock-api-football.mjs`, `package.json`
- this report

All earlier Phase 1B/1C uncommitted files listed by `git status --short` remain part of the review set; none were reverted.

## Migration dependency order

Apply manually to `football-scores-dev` only:

1. `supabase/migrations/20261115_phase1b_football_cache.sql`
2. `supabase/migrations/20261124_phase1b_usage_and_cache_maintenance.sql`
3. `supabase/migrations/20261124_phase1c_reliability_and_coordination.sql`
4. Run `supabase/validation/20261124_phase1c_validation.sql` in one session and confirm its final `rollback`.

The Phase 1C migration is additive: existing cache/usage rows remain. It disables the older non-idempotent service-role overload instead of dropping usage data. Application rollback remains `FOOTBALL_PERSISTENCE_ENABLED=false` followed by restart. Schema removal is intentionally not scripted because it would be destructive.

Validation output must show RLS enabled, `postgres` ownership, `SECURITY DEFINER`, empty `search_path`, service-role-only privileged execute grants, failed non-owner release and one row for a duplicate attempt ID. Test `anon` and `authenticated` RPC calls through their actual API roles before enabling persistence.

## Reproducible two-instance integration procedure

Prerequisites: a disposable or development Supabase project with all three migrations and validation complete. Never use `sports-platform`. Use a dedicated test key value only for the mock.

1. Start the controlled provider: `npm run mock:football`. It binds only `127.0.0.1:4310` and accepts `integration-test-key`.
2. Build once with test configuration. For two separate shells, set identical `SUPABASE_URL`, test-only `SUPABASE_SECRET_KEY`, `FOOTBALL_PERSISTENCE_ENABLED=true`, `API_FOOTBALL_BASE_URL=http://127.0.0.1:4310`, `API_FOOTBALL_KEY=integration-test-key`, and quota variables. Start `next start` on ports 3213 and 3214.
3. Reset counters with `Invoke-WebRequest -Method POST http://127.0.0.1:4310/__reset`.
4. Request the same uncached homepage/API path concurrently from both ports. Read `http://127.0.0.1:4310/__stats`; the normalized fixture key must equal one. Confirm both responses match and the lease row is released.
5. Repeat the request after restarting both processes; the persistent cache must avoid a provider call.
6. Request different cache keys concurrently and confirm each key receives one call while daily/minute reservations remain within configured limits.
7. In a transaction or isolated test data, seed an expired lease and verify recovery; seed a current lease with another owner and verify bounded waiting/stale fallback. Attempt owner-guarded writes with the old token and verify `false` with unchanged cache data.
8. Run the mock with `MOCK_API_FOOTBALL_FAILURE=429`, then `500`; verify cooldown/no immediate retry and eligible stale fallback. Stop Supabase access temporarily to verify local dedupe/provider availability and explicitly degraded global guarantees.
9. Replay the same usage event UUID twice through the service-role RPC and verify one attempt row/one daily increment. Test timestamps across UTC midnight.
10. Record outputs without keys, URLs containing credentials, raw database errors or account fields. Remove only test rows by their explicit test cache keys after separate approval.

These steps are prepared, **not executed** in this audit.

## Performance and storage assessment

- Fresh persistent hit: normally one Supabase cache read and zero provider calls.
- Lease-owner miss: approximately seven database operations—initial read, lease acquisition, owner recheck, quota reservation, guarded cache write, usage event and lease release.
- Contended waiter: initial read plus lease RPC and up to roughly 13 cache polls over the default 2.5-second/200ms window, followed by an optional stale read. This is bounded but is the largest query-amplification risk.
- Current homepage: one fixture-date provider key; league snapshot: cached catalog plus three parallel keys (teams, standings when covered, fixtures). Match detail uses one enriched fixture key rather than four detail endpoints.
- Cache storage grows by distinct namespace/path/parameter keys. Payload sizes were not measured against real provider data because live calls were prohibited.
- `football_api_attempts` grows once per actual data attempt. No retention deletion is enabled; define licensing/audit retention before production scale.
- Cleanup uses indexed expiry ordering, bounded limits and `SKIP LOCKED`. Lifecycle maintenance is capped at 100 rows per state transition batch.

Recommended later optimizations: increase contention poll intervals with jitter, combine owner recheck/acquisition where practical, sample payload sizes in development, define usage-event partition/retention, and monitor cache hit ratio before adding infrastructure.

## Automated validation result

Latest pre-report run:

- `npm test`: superseded by the Phase 1D validation report; this Phase 1C checkpoint had 33/33 passing.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed after correcting the nullable freshness type exposed by the first audit run.
- `npm run build`: passed with persistence and provider credentials explicitly disabled for the final run.
- `npm run lint`: passed.
- No live provider, browser, Supabase integration or two-process database test was claimed.

## Final decisions

**Development migration readiness: CONDITIONAL GO** for manual application to `football-scores-dev` after SQL peer review. Do not enable persistence until validation and role tests pass.

**Integration readiness: NO-GO** until the prepared two-process suite passes against the isolated development/test database.

**Production readiness: NO-GO** until credential rotation, development migration validation, plan/batching verification, retention approval, shared-egress assessment and integration tests are complete.
