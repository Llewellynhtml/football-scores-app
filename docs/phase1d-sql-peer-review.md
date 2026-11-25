# Phase 1D SQL peer-review corrections

The supplied request was truncated at DB-06 after “Correct rolling-minute”. This report covers every complete requirement available: DB-01 through DB-05 and the visible UTC-midnight/stable-lock portion of DB-06. Missing text was not inferred.

## Corrections

### DB-01 — guarded cache writes

`write_football_cache_if_lease_owner` now locks the lease row with `SELECT ... FOR UPDATE`, then validates owner and expiry and writes the cache in the same transaction. Lease acquisition’s conflicting upsert and guarded writes therefore serialize on the same row. Timestamp ordering is no longer the protection mechanism. The application no longer performs a direct persistent upsert when no lease owner exists; database-outage provider responses remain available to the caller but are not unsafely persisted.

Fencing counters were evaluated but are not necessary for this transaction shape: if the old owner locks first while valid, its write completes before a replacement acquisition; if replacement acquisition wins first, the old owner observes the new token and fails. The concurrent integration script tests the expiration boundary.

### DB-02/03 — quota lifecycle and crash accounting

One `football_api_attempts` row now owns the lifecycle and quota slot. Reservation, dispatch and finalisation acquire the same stable advisory transaction lock keyed by `FOOTBALL_QUOTA_SCOPE`. Lock ordering is always advisory scope lock, then attempt row locks, then daily aggregate upsert.

Only `RESERVED` rows can expire to `CANCELLED`. The requester calls `dispatch_football_api_attempt` before `fetch`. A dispatched process crash is changed in bounded maintenance to `UNKNOWN_OUTCOME`, which remains counted for its stored UTC day and rolling-minute window. It cannot permanently block future days. Successful or failed responses transition atomically to `FINALISED`; an acknowledgement-loss retry returns false without a second increment.

PostgreSQL’s default `READ COMMITTED` isolation is sufficient here because every quota-changing RPC serializes on the same account-scope advisory transaction lock and locks its attempt row before transition. No session lock is assumed across RPC calls.

### DB-04 — explicit duplicate outcomes

Reservation returns `ACQUIRED`, `ALREADY_RESERVED`, `ALREADY_DISPATCHED`, `ALREADY_FINALISED`, `DAILY_LIMIT_REACHED`, `MINUTE_LIMIT_REACHED` or `INVALID_REQUEST`. Dispatch returns `DISPATCHED` plus explicit duplicate/expired/limit/invalid states. Only `DISPATCHED` authorizes a provider call. `ALREADY_RESERVED` safely handles reservation acknowledgement loss; `ALREADY_DISPATCHED` fails closed because the caller cannot prove whether a provider request already followed the earlier acknowledgement.

### DB-05 — NULL cleanup limits

Both cleanup RPCs now explicitly reject NULL, zero, negative and values over 5,000. The legacy cleanup also uses `FOR UPDATE SKIP LOCKED`; Phase 1C cleanup already deletes only `stale_until <= now()` rows and expired leases in bounded batches.

### DB-06 — UTC midnight

The advisory key is stable across midnight and scoped to the configured provider quota account/environment. Time and daily window are determined after acquiring the lock. If a valid reservation crosses midnight, dispatch rechecks the new UTC day’s capacity and moves the attempt to the dispatch day. A reservation older than one minute also rechecks the rolling-minute window before dispatch.

## Test preparation

- Deterministic tests statically verify the SQL lock, state and NULL-limit invariants.
- Requester tests cover duplicate reservation IDs, reservation acknowledgement retry and dispatch acknowledgement loss.
- `scripts/test-phase1d-concurrency.mjs` performs genuinely concurrent RPC calls for lease expiry/write fencing, a one-slot quota race, duplicate dispatch and idempotent finalisation.
- The integration script refuses to run unless explicitly pointed at an isolated database identified as `football-scores-dev`. It was prepared, not executed.

Run after manually applying outstanding migrations to an isolated development clone:

```powershell
$env:PHASE1D_ISOLATED_DATABASE='true'
$env:SUPABASE_TEST_PROJECT_NAME='football-scores-dev'
$env:SUPABASE_URL='development URL'
$env:SUPABASE_SECRET_KEY='development secret'
npm run test:phase1d:concurrency
```

The script finalises one synthetic attempt and therefore changes the isolated daily aggregate. Do not run it against production or a development database whose operational metrics must remain pristine.

## Readiness

Local verification completed on 24 November 2026: 39/39 tests passed, TypeScript and ESLint passed, the production build completed with provider and persistence credentials disabled, `git diff --check` passed, and `npm audit --audit-level=high` reported zero vulnerabilities.

SQL static review: corrected. Local PostgreSQL syntax execution was unavailable because `psql` is not installed. Development migration status remains **NO-GO** until a second SQL peer review confirms the revised function signatures and the transactional validation script passes in an isolated development database.
