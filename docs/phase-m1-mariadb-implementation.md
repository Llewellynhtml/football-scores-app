# Phase M1 MariaDB implementation

## Status and decisions

Phase M1 adds an isolated MariaDB 11.8-compatible persistence implementation while retaining Supabase. `DATABASE_PROVIDER` selects exactly one adapter; no automatic fallback or dual writing exists. The default remains `supabase`, so existing deployments do not change unless configuration is explicitly changed.

**Local integration readiness:** READY after a developer installs/starts MariaDB 11.8, creates a uniquely named isolated database, applies the migrations, and runs the guarded integration suite. The code, DDL, and harness are prepared; no MariaDB server was available during this implementation, so database integration tests remain unexecuted.

**Hosted migration readiness:** NO-GO. hPanel confirms 50 GB account disk, 3,072 MB RAM, two CPU cores, 600,000 inodes, 120 processes, and the UK server/Germany backup locations. Seven-day peaks are CPU 15%, memory 201 MB, PHP workers 3/60, and IOPS 512/512 with no reported faults; IOPS saturation occurred several times and its source is unknown. Session UTC, READ COMMITTED, `STRICT_TRANS_TABLES`, InnoDB strict mode, and a five-second lock wait have been verified in phpMyAdmin. Individual database capacity, backup retention/restoration, remote connectivity, intended-site access, and cron frequency remain unverified. No hosted application connection or migration was attempted.

**Production decision:** NO-GO until the migration runbook gates, two-process tests, hosted staging load measurements, and restore rehearsal pass.

## Changed-file register

| File | Purpose |
|---|---|
| `.env.example` | Explicit provider and server-only MariaDB pool settings |
| `package.json`, `package-lock.json` | `mysql2` and guarded MariaDB commands |
| `src/lib/football-persistence.ts` | Stable compatibility façade delegating to one adapter |
| `src/app/api/database/health/route.ts` | Provider-neutral configuration-only health response |
| `src/lib/database/types.ts` | Common persistence contract |
| `src/lib/database/config.ts` | Strict provider/pool configuration validation |
| `src/lib/database/index.ts` | Explicit adapter selection |
| `src/lib/database/supabase-adapter.ts` | Preserved Supabase behavior behind the contract |
| `src/lib/database/mysql-pool.ts` | Hot-reload-safe bounded pool and fail-closed session initialization |
| `src/lib/database/mysql-transactions.ts` | Connection lifecycle and bounded transaction retry |
| `src/lib/database/mysql-adapter.ts` | MariaDB cache, lease, quota, usage, cleanup, and health operations |
| `mariadb/migrations/001_schema_migrations.sql` | Migration ledger |
| `mariadb/migrations/002_cache_and_quota.sql` | Operational tables and indexes |
| `mariadb/migrations/003_maintenance.sql` | Maintenance audit table |
| `mariadb/validation/read-only-capabilities.sql` | Read-only engine/schema/size inspection |
| `scripts/mariadb-migrate.mjs` | Isolated-database-only ordered migration runner |
| `scripts/mariadb-maintenance.mjs` | Explicit, bounded external cleanup command |
| `scripts/mariadb-capacity.mjs` | Read-only table/index sizing with provisional capacity thresholds |
| `scripts/load-test-mariadb.mjs` | Loopback-only two-process load and mock-provider consumption measurements |
| `scripts/validate-mariadb-local.mjs` | Identity/session/schema preflight before local migrations |
| `scripts/lib/mariadb-local-guard.mjs` | Shared loopback/test-name/mock-key safety boundary |
| `.env.mariadb.local.example` | Placeholder-only isolated local configuration |
| `docs/phase-m2-local-mariadb-runbook.md` | Exact Windows CMD setup and execution sequence |
| `.github/workflows/mariadb-integration.yml` | Disposable MariaDB 11.8.9 CI integration workflow |
| `scripts/test-mariadb-adapter.mts` | Actual adapter lease/quota lifecycle contract tests |
| `scripts/verify-mariadb-persistence.mjs` | Restart persistence and mock-consumption assertion |
| `scripts/verify-mariadb-restore.mjs` | Restored row-count and cache-digest comparison |
| `docs/phase-m3-github-actions-testing.md` | Remote architecture, execution, reports, and blockers |
| `scripts/test-mariadb-integration.mjs` | Guarded session/rollback/concurrency/idle test harness |
| `src/lib/phase-m1-mariadb.test.mjs` | Database-free static architecture checks |
| `docs/phase-m1-mariadb-implementation.md` | Implementation handoff and decisions |
| `docs/mariadb-local-setup.md` | Windows/native/Docker setup |
| `docs/mariadb-migration-runbook.md` | Apply, validate, cut over, and roll back |
| `docs/mariadb-integration-testing.md` | Test matrix and outstanding execution |

Existing uncommitted files were preserved. PostgreSQL migrations and the Supabase dependency were not removed.

## Adapter architecture

`football-persistence.ts` remains the application-facing API. It selects a single `FootballPersistenceAdapter` through `database/index.ts`. The common interface covers cache reads, lease lifecycle, owner-protected writes, quota reservation/dispatch/finalisation, daily usage, bounded cleanup, and health. Provider-specific SQL and client behavior cannot leak into request/UI code.

`DATABASE_PROVIDER` accepts only `supabase` or `mysql`. An invalid value fails configuration. `FOOTBALL_PERSISTENCE_ENABLED=true` still gates durable behavior, and the selected provider must be fully configured. A selected but unavailable database is never silently replaced with another provider.

## Pool and session behavior

The installed `mysql2` promise pool supports the requested `connectionLimit`, `maxIdle`, `idleTimeout`, `queueLimit`, `connectTimeout`, `waitForConnections`, `timezone`, and keepalive options. Defaults are 5 active connections, 2 idle, 10-second idle eviction, queue 50, and 5-second connect/acquire timeouts.

The pool is stored on `globalThis` to prevent Next.js development reload multiplication. Acquisition uses a timeout race; if a timed-out queued acquisition later succeeds, its connection is immediately released. Every physical connection must successfully set UTC, READ COMMITTED, `STRICT_TRANS_TABLES`, InnoDB strict mode, and a five-second lock wait before application work. Initialization failure destroys the connection and fails closed. Hostinger permissions for all session statements must be tested before migration.

Pool diagnostics record active/pending acquisitions, acquisition timeouts, total/average/max wait. The starting limit remains five per Node process, with two idle connections evicted after 10 seconds—below the verified 20-second server idle timeout. Because the account has two CPU cores and 3 GB RAM shared across as many as 50 websites, increasing this pool is prohibited until load evidence shows a database wait bottleneck and hPanel shows CPU/RAM/I/O/process headroom.

Authenticated usage diagnostics now include operation counts and latency by database operation, transaction attempts/commits/rollbacks/retries, pool waits, derived database operations per observed request, and persistent-cache hit ratio. These are process-local; a two-instance test captures both processes before and after the same interval.

### I/O amplification audit

A fresh cache hit performs one indexed cache `SELECT` and no MariaDB write. Cache-hit diagnostics are process-memory updates only. A cold provider result is deliberately more expensive: cache read, lease transaction, post-lease cache recheck, quota reservation transaction, dispatch transaction, finalisation plus aggregate upsert, and guarded cache write/lease delete. Depending on lifecycle maintenance and contention this is roughly 15–25 SQL statements across five short write transactions. A contending waiter can add repeated indexed cache reads during its bounded 2.5-second polling window. Attempt state and four supporting indexes amplify each attempt write; daily aggregates add one small hot-row update; cleanup causes page changes but remains bounded/index ordered.

The observed 512/512 IOPS peak is a risk signal, not proof of 512 SQL queries per second. Physical I/O depends on buffer-pool hits, dirty-page flushing, redo/binlog/fsync policy, index page locality, checkpointing, backups, files/websites sharing the account, and storage-layer accounting. SQL statement rate may be higher or lower than physical IOPS. Establish causation by matching load-test wall-clock intervals to hPanel graphs and application counters; do not increase pool/concurrency to “use spare CPU” while IOPS provenance is unknown.

Transaction retry is limited to deadlock 1213 and lock timeout 1205, at most three attempts with jitter. Operations carry stable owner/attempt identifiers. An ambiguous commit is not classified as a retryable error and is not automatically replayed.

## Schema and storage choices

All operational tables are InnoDB. Identifiers use ASCII binary collation; human/payload fields use `utf8mb4_bin`. UUIDs use `BINARY(16)`. Time values use UTC `DATETIME(6)`. Cache JSON is `LONGTEXT` with `JSON_VALID`; application validation remains authoritative. Daily usage is keyed by `(quota_scope, day)`, preventing accounts/environments sharing one table from mixing aggregates.

The 1 GiB server packet limit is not an application payload target. Phase M1 intentionally does not assign a large cache ceiling without measured payload data. Before hosted staging, add an application-level maximum based on observed p99 payload size and the actual database allowance.

Until the per-database limit is confirmed, capacity tooling uses 3,072 MB. It emits `WARNING` at 60%, `ALERT` at 70%, and reports table data/index bytes separately. The target is to retain approximately 30% free capacity. At higher request volumes, detailed `FINALISED`/`CANCELLED` attempts receive short retention; daily aggregates and unresolved outcomes are retained, and deletions remain bounded so idempotency/audit windows are explicit.

## Locking and quota correctness

Lease acquisition uses a conditional duplicate-key update and then verifies the owner under lock. Cache writes lock the lease row, reject expired/nonmatching owners, upsert cache data, and remove the lease in one transaction. No transaction spans an API-Football call.

Reserve, dispatch, and finalise first insert-if-absent and `SELECT ... FOR UPDATE` the stable `football_quota_locks` row. They then lock attempt state and update lifecycle/aggregate data. This replaces PostgreSQL's transaction advisory lock without using connection-scoped `GET_LOCK`. Reservations and dispatch use database UTC time, recheck day/minute boundaries, treat dispatched crashes conservatively, reject duplicates, and apply the newest provider remaining/limit snapshot.

Cleanup accepts only integer batches 1–5,000. The event scheduler is not used. Maintenance must be invoked externally and remains disabled unless `MARIADB_MAINTENANCE_ENABLED=true` is explicitly set.

## Verification performed

- `mysql2` installed successfully; npm reported no vulnerabilities.
- TypeScript type checking completed successfully during implementation.
- Database-free static tests cover InnoDB/scoped aggregates, stable quota row locking, owner-locked cache writes, and mandatory session initialization.
- The existing 39 scenarios are preserved and are part of the final verification command.

No MariaDB integration test, migration, hosted query, provider call, deployment, commit, or push was performed. See `mariadb-integration-testing.md` for the exact outstanding matrix.
