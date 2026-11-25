# MariaDB integration testing

## Execution status

The database-independent suite and static MariaDB design tests are runnable with `npm test`. Type checking is runnable with `npm run typecheck`. Local installation is unavailable without administrator rights; `.github/workflows/mariadb-integration.yml` now prepares the exact MariaDB 11.8.9 tests remotely. The workflow has not executed, so every database-backed result remains **pending**. No hosted database, Supabase project, or real API-Football endpoint was contacted.

## Safety guards

Migration, validation, integration, and maintenance scripts require `MARIADB_ISOLATED_DATABASE=true`, `DATABASE_PROVIDER=mysql`, a loopback database host, and a narrowly matched `football_scores_test_*` name. Integration additionally requires the loopback mock and the literal `integration-test-key`; missing values fail rather than falling back to inherited credentials. Use a distinct database per developer/CI run and never reuse the live application database.

## Local execution

1. Complete `mariadb-local-setup.md` and apply migrations.
2. Start `npm run mock:football` with a test-only key.
3. Run:

   ```powershell
   npm run test:mariadb:integration
   npm test
   npm run typecheck
   npm run build
   ```

4. Build once, then start two `next start` processes on ports 3213 and 3214 with identical database/quota configuration and the loopback mock. Drive identical cache keys and constrained quota scopes against both.

## Required matrix

| Scenario | Prepared coverage | Required before hosted GO |
|---|---|---|
| Pool/session initialization | Integration script + application pool | Verify UTC, READ COMMITTED, strict modes and 5s lock timeout |
| Idle over 20 seconds | Integration script waits 21s then queries | Repeat against local and hosted staging; ensure no leaked/poisoned connection |
| Strict SQL | Session assertion; schema CHECKs | Insert invalid JSON/overflow/bad state and assert rejection |
| Rollback | Integration script insert/rollback/count | Pass |
| Concurrent lease acquisition | Integration script two clients | Exactly one owner |
| Expired takeover/obsolete owner | Adapter design prepared | Add timed takeover and guarded-write assertion |
| Concurrent quota reservations | Adapter + scope mutex prepared | Two processes, limit one: one ACQUIRED |
| Duplicate dispatch/finalise | Adapter idempotency prepared | One transition/aggregate increment |
| Crash after dispatch | UNKNOWN_OUTCOME maintenance prepared | Kill process; after threshold row remains counted |
| UTC midnight/minute boundary | Database UTC logic prepared | Use controllable clock/test seam or boundary fixture |
| Provider reconciliation | Timestamp conditional upsert prepared | Older snapshot must not overwrite newer |
| Deadlock/lock timeout | Retry helper prepared | Force 1213/1205; bounded retry, no duplicate effect |
| Outage/recovery | Fail-closed acquisition prepared | Stop DB; provider dispatch blocked when shared quota required; recover cleanly |
| Bounded cleanup | Limits and SQL prepared | NULL/0/5001 rejected; at most N rows per category |
| Two Next.js processes | Procedure prepared | Shared cache and quota correctness with mock provider |
| Size/latency/amplification | Read-only size SQL prepared | Record table/index growth, pool wait, query/transaction p95/p99 |
| Shared-host resources | Loopback load script and hPanel checklist prepared | Record application CPU/RSS plus hPanel CPU/RAM/I/O/process usage before/during/after |
| Capacity thresholds | `db:mariadb:capacity` prepared | Confirm actual cap; warning at 60%, alert at 70%, ~30% headroom |

## Test data cleanup

Use UUID-based cache keys and quota scopes. Delete only those exact identifiers in `finally` blocks. If a process-kill test prevents cleanup, run a reviewed query filtered to that run ID. Never use an unbounded delete. Database teardown must validate the exact isolated name before dropping it.

## Load-test preparation

With two local application processes and the mock provider running, execute `npm run test:mariadb:load`. The script refuses non-loopback application or provider URLs, caps concurrency at 50 and requests at 10,000, reports p50/p95/p99/max latency and failures, and reads `/__stats` to show mock upstream consumption. Start conservatively (200 requests, concurrency 10). Capture each Node process with `Get-Process -Id <pid> | Select-Object CPU,WorkingSet64,PrivateMemorySize64,Threads,Handles` before/during/after, collect pool diagnostics, run the capacity report, and compare hPanel Resources Usage only in a separately approved hosted-staging exercise.

## Readiness interpretation

- **Local integration ready:** the harness and instructions are complete, but this becomes “validated” only after all local rows above pass on MariaDB 11.8.
- **Hosted migration:** NO-GO until isolated hosted staging, load, backup/restore, and policy checks pass.
- **Production:** NO-GO. Static tests and unit mocks do not prove transactional behavior on the hosted engine.
