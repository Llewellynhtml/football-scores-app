# Hostinger MariaDB migration assessment

**Decision checkpoint:** 25 November 2026
**Scope reviewed:** repository branch/worktree as supplied, including the uncommitted Phase 1B–1D work
**Decision:** **CONDITIONAL GO for an isolated proof of compatibility; NO-GO for production migration**

## 1. Executive summary

Replacing Supabase PostgreSQL with the MariaDB service included in Hostinger Business Web Hosting is technically feasible without rebuilding the Next.js/React application. The HTTP, provider, cache-policy, local-deduplication, error-handling, and UI layers can remain substantially unchanged. The change is nevertheless a database-engine port, not a connection-string change: the present reliability boundary is implemented by PostgreSQL RPC functions, `jsonb`, `timestamptz`, partial indexes, `ON CONFLICT`, `SKIP LOCKED`, and a scope-wide transaction advisory lock.

The recommended MariaDB design uses `mysql2/promise`, InnoDB transactions, a provider-neutral TypeScript interface, and an explicit `football_quota_locks` row per quota scope. Locking that row with `SELECT ... FOR UPDATE` at the beginning of reserve, dispatch, and finalise transactions replaces PostgreSQL's `pg_advisory_xact_lock` while retaining transaction-scoped release and a consistent lock order. It is preferable to MariaDB `GET_LOCK()`, whose lifetime is connection-scoped and independent of transactions, making it unsafe to expose through a general-purpose pool.

Hostinger hPanel now confirms a 2-core, 3 GB RAM shared-hosting account with 50 GB total hosting disk and MariaDB 11.8.9/InnoDB. The individual database capacity, current resource consumption, backup retention, session-setting permissions, connectivity policy, and cron frequency are still pending. The 50 GB account disk allocation must not be treated as database capacity; planning continues against a provisional 3 GB database cap.

The included database is a good fit for provider cache and modest football reference data. It can also hold short-retention request attempts at 100 or 7,500 requests/day. At 75,000 requests/day, an append-heavy attempt ledger will approach a 3 GB database rapidly unless it is aggressively partitioned/archived or summarized; shared hosting is then the wrong long-term coordination store. A conservative 30-day attempt retention plus durable daily aggregates is proposed.

**Recommendation:** approve only a time-boxed, isolated MariaDB proof of compatibility after confirming hPanel limits and backup/restore behavior. Do not switch production until the MariaDB adapter passes the existing 39 scenarios, engine-specific tests, two-process concurrency tests, fault injection, and a measured load test. Preserve Supabase and a provider switch for rollback throughout evaluation.

## 2. Evidence and assumptions

Repository evidence is from the supplied worktree, not only committed Git state. No database was contacted or modified. No provider request was made.

Current official references:

- [Hostinger: connect a MySQL database to Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Hostinger: Web and Cloud hosting use MariaDB](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/)
- [Hostinger: hosting-plan parameters and limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/)
- [Hostinger: supported databases, InnoDB, and no event scheduler on Web/Cloud](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/)
- [MariaDB: `SELECT ... FOR UPDATE`](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update)
- [MariaDB: transaction isolation](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/set-commands/set-transaction)
- [MariaDB: `INSERT ... ON DUPLICATE KEY UPDATE`](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/inserting-loading-data/insert-on-duplicate-key-update)
- [MariaDB: `GET_LOCK`](https://mariadb.com/docs/server/reference/sql-functions/secondary-functions/miscellaneous-functions/get_lock)

Hostinger's public page currently lists, for its top Web tier, a 3 GB per-database limit, 75 connections per user, 16 MB packet size, 300-second statement limit, and 120-second query limit. Older/newer plan generations differ, and Cloud tiers are larger. Treat these values as planning bounds only; record the subscribed account's hPanel values before approval. Hostinger also warns that exceeding a database-size limit can suspend writes, which would degrade global cache coordination and quota enforcement.

### Verified Hostinger infrastructure supplement

| Item | Verified value | Architecture consequence |
|---|---:|---|
| Hosting disk | 50 GB | Shared account allocation; not evidence of the per-database limit |
| RAM | 3,072 MB | Keep application/pool/background work bounded; measure Node RSS under load |
| CPU | 2 cores | Avoid uncontrolled workers and expensive scans; keep transactions short/indexed |
| Inodes | 600,000 | Relevant to the whole account, not a substitute for database byte monitoring |
| Websites/processes | 50 websites / 120 processes | Resources may be consumed by unrelated sites; measure present hPanel usage |
| PHP workers | 60 | Not a Node pool budget and not a MariaDB connection allowance |
| Bandwidth | Displayed as unlimited | Does not remove CPU, I/O, connection, or provider-quota constraints |
| Server/backup region | United Kingdom / Germany | Record data-location implications; backup frequency/retention remain pending |
| MariaDB | 11.8.9, InnoDB, READ COMMITTED | Compatible target; session overrides still require an isolated permission test |
| Connections | 2,000 server / 75 per user | Start at five per Node process and budget all instances plus maintenance headroom |
| Idle timeout | 20 seconds | Evict idle pool connections at 10 seconds and test transparent reconnection |
| Database cap | Pending | Use 3,072 MB provisionally, warn at 60%, alert at 70%, preserving ~30% headroom |

Current hPanel usage is low for disk (568 MB of roughly 51,200 MB), inodes (24,100/600,000), CPU (15% seven-day peak), memory (201 MB peak of roughly 3,100 MB), and PHP workers (3/60), with no reported resource faults. However, IOPS reached 512/512 several times. That saturation overrides any inference that low CPU/RAM means abundant database headroom until its source is identified. Hostinger IOPS are storage operations, not SQL-query counts; caching, index fan-out, flush behavior, backups, and other hosted sites affect the relationship.

phpMyAdmin has verified that the hosted user may set and read back session timezone `+00:00`, READ COMMITTED, `STRICT_TRANS_TABLES`, InnoDB strict mode ON, and lock wait timeout 5 seconds. Application connections must still perform and verify equivalent initialization; this evidence removes the permission uncertainty but not the need for fail-closed initialization.

Hostinger reports daily automatic and manual backups. Retention, per-database restore granularity, and an actual recovery rehearsal remain production gates.

The selected temporary-domain website must be confirmed as part of the same hosting subscription as the intended football application, and the database must be confirmed accessible from that Node.js application, before hosted staging. This is a configuration/ownership check, not authorization to connect yet.

## 3. Existing Supabase dependency register

| Area | Current implementation | PostgreSQL/Supabase dependency | Disposition |
|---|---|---|---|
| Client/config | `src/lib/supabase.ts` | `@supabase/supabase-js`, URL and publishable/service keys | Retain as Supabase adapter during evaluation; introduce provider-neutral config |
| Persistence façade | `src/lib/football-persistence.ts` | Direct `.from()` reads and seven `.rpc()` calls | Rewrite behind an interface; preserve exported business result types |
| Cache rows | `football_provider_cache` | `jsonb`, `timestamptz`, PostgreSQL upsert | MariaDB table and adapter methods |
| Cache coordination | `football_cache_leases` and three RPCs | conflicting upsert, row lock, UUID type, database clock | MariaDB transactions and row locks |
| Attempt lifecycle | `football_api_attempts` | PostgreSQL UUID/checks, partial index, advisory transaction lock | MariaDB table plus transactional adapter methods |
| Daily usage | `football_api_usage_daily` | conditional `ON CONFLICT` aggregate update | MariaDB transactional upsert/update |
| Quota reservation | rows in `football_api_attempts` (there is no separate current reservation table) | advisory scope lock, UTC database time, bounded state cleanup | Add scope mutex row; retain lifecycle model |
| Provider snapshots | columns on attempts and daily usage | timestamp-ordered conditional update | Retain columns and compare under lock |
| Maintenance | two cleanup RPCs | CTE delete, `ctid`, `FOR UPDATE SKIP LOCKED` | Adapter transaction using keyed batches; external cron/manual invocation |
| Health | `src/app/api/database/health/route.ts`, `src/app/api/health/route.ts` | Supabase-specific configuration/service label | Make provider-aware; never expose host, user, version, or raw error publicly |
| Usage endpoint | `src/app/api/usage/route.ts` | durable daily read via Supabase façade | Retain route contract; change adapter only |
| Retry buffer | `src/lib/usage-queue.ts` | no engine dependency | Retain unchanged |
| Local metrics/quota | `src/lib/api-usage.ts`, `src/lib/football-quota.ts` | no engine dependency | Retain unchanged |
| Request/caching flow | `football-request.ts`, `football.ts`, `football-cache.ts` | persistence function contract only | Retain after dependency inversion |
| SQL migrations | three files under `supabase/migrations` | PostgreSQL DDL/PLpgSQL/RLS/grants | Keep; add separate MariaDB migrations, never edit into dual-dialect SQL |
| Validation | `supabase/validation/20261124_phase1c_validation.sql` | PostgreSQL catalogue and PLpgSQL | Keep; add MariaDB catalogue/transaction validation |
| Static SQL tests | `src/lib/phase1d-sql.test.mjs` | regexes for PostgreSQL functions/advisory locks | Retain for Supabase; add MariaDB-specific tests |
| Concurrency script | `scripts/test-phase1d-concurrency.mjs` | Supabase client/RPCs | Generalize scenarios and add a MariaDB runner |
| Dependencies | `package.json` | `@supabase/supabase-js` | Keep during evaluation; add `mysql2` only after approval to implement POC |

No repository table currently persists leagues, seasons, teams, standings, fixtures, match details, or operational maintenance records. Those appear only as proposed future architecture. Their future schemas should reference stable provider IDs and have explicit retention/provenance rules; they are not prerequisites for moving the current cache/quota subsystem.

## 4. Components requiring modification

1. Add `src/lib/database/types.ts`, `config.ts`, `index.ts`, `supabase-adapter.ts`, `mysql-adapter.ts`, and `mysql-pool.ts`.
2. Move Supabase calls out of `football-persistence.ts`; keep it as a compatibility façade or replace its imports with the database interface.
3. Make `/api/database/health` and the aggregate health route provider-neutral.
4. Add MariaDB migrations, read-only capability inspection, validation, cleanup, migration, and concurrency scripts.
5. Add `mysql2` and provider-specific environment validation only during the approved POC.
6. Extend CI to start an isolated version-pinned MariaDB service and run both common contract tests and MariaDB concurrency tests.
7. Replace PostgreSQL-specific SQL tests with parallel dialect suites, not a weakened common regex suite.

## 5. Components that can remain unchanged

The Next.js routes/pages and React UI; API-Football request construction and response validation; cache key generation and cache-row application validation; cache TTL/stale policy; process-local request deduplication; provider cooldown; quota configuration and essential-request classification; bounded in-memory usage queue; provider outcome types; diagnostics shape; mock API-Football server; and all tests that mock the persistence boundary can remain unchanged or require only import injection.

## 6. Provider-neutral persistence interface

```ts
export type DatabaseProvider = "supabase" | "mysql";

export interface FootballPersistence {
  health(): Promise<{ ok: boolean; provider: DatabaseProvider }>;
  readCached(key: string, allowStale?: boolean): Promise<CachedResponse | null>;
  acquireCacheLease(key: string, ownerToken: string, leaseSeconds: number): Promise<boolean>;
  writeCachedIfLeaseOwner(input: CacheWrite): Promise<boolean>;
  releaseCacheLease(key: string, ownerToken: string): Promise<boolean>;
  reserveProviderQuota(input: QuotaReservation): Promise<QuotaReservationResult>;
  dispatchProviderAttempt(attemptId: string, quotaScope: string): Promise<DispatchResult>;
  finaliseProviderAttempt(event: UsageEvent): Promise<boolean>;
  readDailyUsage(dayUtc: string): Promise<DurableUsage | null>;
  cleanupExpired(limit: number): Promise<{ cacheRows: number; leaseRows: number }>;
}
```

`index.ts` constructs exactly one adapter from validated server-only configuration. Suggested evaluation settings:

```dotenv
DATABASE_PROVIDER=supabase
FOOTBALL_PERSISTENCE_ENABLED=false

# MySQL/MariaDB, server-only; use the actual hPanel host and TLS requirements.
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_CONNECTION_LIMIT=5
MYSQL_QUEUE_LIMIT=50
MYSQL_CONNECT_TIMEOUT_MS=5000
MYSQL_ACQUIRE_TIMEOUT_MS=5000
```

Do not accept `NEXT_PUBLIC_` database variables. Parse integer bounds strictly. Require `DATABASE_PROVIDER` to be an allowlisted value; do not silently fall back from a misconfigured MySQL selection to Supabase. Rollback is an explicit provider/config change. Keep the pool on `globalThis` in development to avoid hot-reload pool multiplication, set `waitForConnections: true`, use a small connection limit (start at 5 per Node process), set UTC for every checked-out connection, and use `execute()` placeholders. Pool capacity must be calculated as `instances × pool limit + maintenance/test connections`, comfortably below the hPanel per-user limit.

## 7. Proposed MariaDB schema

Target exact syntax only after the capability script confirms the engine/version. Use `ENGINE=InnoDB`, `utf8mb4`, ASCII/case-sensitive collations for identifiers, and `DATETIME(6)` interpreted as UTC. MariaDB `TIMESTAMP` has range and session-time-zone behavior that is unnecessary here.

```sql
CREATE TABLE football_provider_cache (
  cache_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  payload LONGTEXT NOT NULL CHECK (JSON_VALID(payload)),
  expires_at DATETIME(6) NOT NULL,
  stale_until DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  KEY cache_stale_idx (stale_until)
) ENGINE=InnoDB;

CREATE TABLE football_cache_leases (
  cache_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  owner_token BINARY(16) NOT NULL,
  acquired_at DATETIME(6) NOT NULL,
  lease_expires_at DATETIME(6) NOT NULL,
  KEY lease_expiry_idx (lease_expires_at)
) ENGINE=InnoDB;

CREATE TABLE football_quota_locks (
  quota_scope VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  touched_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE football_api_usage_daily (
  day DATE PRIMARY KEY,
  outbound_calls BIGINT UNSIGNED NOT NULL DEFAULT 0,
  failed_calls BIGINT UNSIGNED NOT NULL DEFAULT 0,
  successful_responses BIGINT UNSIGNED NOT NULL DEFAULT 0,
  http_errors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  provider_errors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  network_errors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  timeouts BIGINT UNSIGNED NOT NULL DEFAULT 0,
  provider_limit INT UNSIGNED NULL,
  provider_remaining INT UNSIGNED NULL,
  provider_minute_limit INT UNSIGNED NULL,
  provider_minute_remaining INT UNSIGNED NULL,
  last_call_at DATETIME(6) NULL,
  quota_observed_at DATETIME(6) NULL
) ENGINE=InnoDB;

CREATE TABLE football_api_attempts (
  attempt_id BINARY(16) PRIMARY KEY,
  quota_scope VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempted_at DATETIME(6) NOT NULL,
  usage_day DATE NOT NULL,
  essential BOOLEAN NOT NULL,
  reserved_daily_limit INT UNSIGNED NOT NULL,
  reserved_daily_reserve INT UNSIGNED NOT NULL,
  reserved_minute_limit INT UNSIGNED NOT NULL,
  reserved_minute_reserve INT UNSIGNED NOT NULL,
  state ENUM('RESERVED','DISPATCHED','FINALISED','UNKNOWN_OUTCOME','CANCELLED','RECONCILED') NOT NULL,
  reserved_at DATETIME(6) NOT NULL,
  reservation_expires_at DATETIME(6) NOT NULL,
  dispatched_at DATETIME(6) NULL,
  finalised_at DATETIME(6) NULL,
  outcome ENUM('success','http_error','provider_error','network_error','timeout') NULL,
  http_status SMALLINT UNSIGNED NULL,
  provider_limit INT UNSIGNED NULL,
  provider_remaining INT UNSIGNED NULL,
  provider_minute_limit INT UNSIGNED NULL,
  provider_minute_remaining INT UNSIGNED NULL,
  quota_observed_at DATETIME(6) NULL,
  KEY attempts_quota_day_state (quota_scope, usage_day, state),
  KEY attempts_quota_reserved (quota_scope, state, reservation_expires_at),
  KEY attempts_quota_dispatched (quota_scope, state, dispatched_at),
  KEY attempts_attempted (quota_scope, attempted_at)
) ENGINE=InnoDB;

CREATE TABLE football_maintenance_runs (
  run_id BINARY(16) PRIMARY KEY,
  operation VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  started_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  affected_rows INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('RUNNING','SUCCEEDED','FAILED') NOT NULL,
  error_code VARCHAR(64) NULL,
  KEY maintenance_started_idx (started_at)
) ENGINE=InnoDB;
```

`BINARY(16)` minimizes UUID and index size; convert with application code so behavior does not depend on server support for `UUID_TO_BIN`. If operational readability is more important initially, `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin` is a valid, larger POC choice. MariaDB's `JSON` behavior/version differs from MySQL's binary JSON; store payload as text with `JSON_VALID`, parse and validate it in the existing application layer, and do not plan JSON-path indexing without testing the exact engine.

No foreign keys are required among the current four operational tables. Future normalized football reference tables should use `BIGINT UNSIGNED` surrogate keys, unique `(provider, provider_id)` constraints, and explicit foreign keys. Large raw fixture payloads should remain cache data with retention, not be duplicated into every normalized table.

## 8. Transaction and concurrency design

### Cache lease acquisition

In one short transaction, obtain database UTC time (`UTC_TIMESTAMP(6)`), then insert the lease. On duplicate key, use a conditional update only when the existing expiry is at or before database time. Verify success by reading the row/owner in the same transaction; do not infer ownership solely from affected-row semantics, which vary with client flags. Commit before calling API-Football.

### Owner-validated cache write

Begin a transaction; select the lease by primary key `FOR UPDATE`; reject a missing, expired, or nonmatching owner; upsert the cache; delete the lease with both key and owner predicate; commit. Lease replacement and old-owner writes serialize on the same lease row, preserving the Phase 1D fencing argument. Never allow an unleased persistent write.

### Quota lifecycle

Every reserve, dispatch, and finalise transaction follows one lock order:

1. Ensure `football_quota_locks(quota_scope)` exists with an idempotent insert.
2. `SELECT quota_scope FROM football_quota_locks WHERE quota_scope=? FOR UPDATE`.
3. Read `UTC_TIMESTAMP(6)` and derive the UTC `DATE` after the lock is held.
4. Lock the attempt row when present.
5. Perform bounded lifecycle maintenance, count indexed daily/minute rows, enforce local configured and newest provider limits, and make one state transition.
6. Update the daily aggregate if finalising, then commit.

This database row is a durable mutex, not a quota counter. It serializes each account/environment scope just as the PostgreSQL advisory transaction lock does. It avoids gap-lock correctness arguments and `GET_LOCK` pool hazards. A single scope intentionally serializes a small amount of database work, never network I/O.

Reservation creates one UUID attempt row. Dispatch rechecks the UTC day if midnight passed and the rolling minute if the reservation aged past one minute. Only `RESERVED` may become `CANCELLED`; stale `DISPATCHED` becomes `UNKNOWN_OUTCOME` and remains conservatively counted. Finalisation accepts only `DISPATCHED`/`UNKNOWN_OUTCOME`, verifies scope plus exact `attempted_at`, transitions once, and increments the daily aggregate in the same transaction. Duplicate attempt IDs, dispatches, and finalisations return the existing fail-closed outcomes.

### Isolation, deadlocks, and retries

Use an explicit transaction for every locking read. Prefer `READ COMMITTED` for these methods after verifying the hosted setting; correctness comes from explicit scope/row locks, while this level reduces unnecessary gap locking. Do not change the server-global isolation setting. If a per-transaction isolation statement is unavailable to the hosted user, the design also works at InnoDB's usual `REPEATABLE READ` provided all paths retain the same indexed lock order.

Retry a whole transaction only for recognized transient MariaDB codes (deadlock 1213 and lock wait timeout 1205), at most three attempts with jitter, and only where the operation is idempotent by attempt/owner ID. Never retry an upstream HTTP call. Use short lock-wait and application acquisition timeouts if Hostinger permits session settings. Log sanitized codes and latency, not SQL parameters or credentials.

### Bounded cleanup

Reject `NULL`, non-integers, values below 1, and values above 5,000 in TypeScript before SQL. In a transaction select at most `limit` expired primary keys ordered by the indexed expiry column, optionally `FOR UPDATE SKIP LOCKED` only if confirmed by the exact MariaDB version, then delete by primary key. If `SKIP LOCKED` is unavailable, use the same deterministic batch under a short transaction and allow cleaners to serialize. Run from Hostinger cron or an authenticated reviewed maintenance process because Web/Cloud database event scheduling is unavailable.

### Database outage behavior

Retain the current availability choice: reads and cache coordination may degrade to process-local deduplication/stale response behavior, and provider responses obtained during a database outage are not persistently written without valid lease ownership. Quota persistence failure must fail closed when the shared quota guard is required; permitting provider calls on a coordination outage would violate the shared daily/minute guarantees. Expose only a boolean degraded state and alert on it.

## 9. MariaDB compatibility assessment

| Capability | Assessment and required proof |
|---|---|
| InnoDB transactions/row locks | Supported by Hostinger; require all tables to report `ENGINE=InnoDB` |
| `FOR UPDATE` | Supported inside explicit transactions; primary/unique indexes are mandatory |
| Isolation | MariaDB supports required levels; inspect actual session/global values and test at hosted defaults |
| JSON | Not equivalent to PostgreSQL `jsonb` or necessarily MySQL binary JSON; use validated text/JSON and application validation |
| Unique constraints/FKs | Supported by InnoDB; keep keys narrow and collations explicit |
| UTC time | Use database `UTC_TIMESTAMP(6)` and set session `time_zone='+00:00'`; never rely on host local time |
| Indexed queries | Compatible after replacing the PostgreSQL partial dispatched index with `(quota_scope,state,dispatched_at)` |
| Pooling | `mysql2/promise` is appropriate; cap per process and include all instances in connection budgeting |
| Upsert | `ON DUPLICATE KEY UPDATE` is available but differs in syntax/affected-row behavior; verify ownership explicitly |
| Deadlocks | Expected under concurrency; consistent lock order plus bounded transaction retry is required |
| Cleanup | Keyed bounded batches work; gate `SKIP LOCKED` on actual version |
| RLS | No equivalent is needed for this server-only app. Use a least-privilege DB user, no browser credentials, and no public DB API |
| Stored RPCs | Move orchestration into versioned application transactions; Hostinger imports may reject procedure/definer content |
| Advisory locks | Do not use connection-scoped `GET_LOCK`; use the InnoDB scope mutex row |
| Backups | Hostinger advertises daily backups on current Business tiers, but database granularity, retention, restore time, and point-in-time recovery must be verified in the account and rehearsed |
| Shared-host restrictions | No event scheduler; limited CPU/RAM/I/O/connections/query time; no assumption of SUPER privileges or server setting control |

### Read-only hosted capability inspection

Run with a read-only inspection user if Hostinger permits one. The script contains no DDL/DML and prints no credentials:

```sql
SELECT VERSION() AS version, @@version_comment AS version_comment;
SELECT @@session.time_zone AS session_time_zone,
       @@global.time_zone AS global_time_zone,
       @@session.transaction_isolation AS session_isolation;
SELECT @@max_connections AS global_max_connections,
       @@max_user_connections AS max_user_connections,
       @@max_allowed_packet AS max_allowed_packet,
       @@wait_timeout AS wait_timeout,
       @@interactive_timeout AS interactive_timeout;
SELECT DATABASE() AS selected_database,
       CURRENT_USER() AS authenticated_account;
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
SELECT VARIABLE_NAME, VARIABLE_VALUE
FROM information_schema.SYSTEM_VARIABLES
WHERE VARIABLE_NAME IN
  ('innodb_lock_wait_timeout','max_statement_time','sql_mode','event_scheduler')
ORDER BY VARIABLE_NAME;
```

Some variables or `information_schema.SYSTEM_VARIABLES` may be restricted. A permission error is a recorded capability result, not a reason to request elevated privileges. Verify `SKIP LOCKED`, CHECK enforcement, microsecond timestamps, connection/TLS behavior, and DDL in the disposable POC database, not by mutating production.

## 10. Storage and query-amplification assessment

Sizing depends heavily on URL/key length, provider payload size, indexes, page fill, and MariaDB version. The following planning model uses **0.6–1.0 KB per attempt row including indexes**, 0.5 KB per daily aggregate, and excludes cache/reference payloads:

| Provider requests/day | Attempt ledger/day | 30-day ledger | 90-day ledger | Suitability |
|---:|---:|---:|---:|---|
| 100 | 0.06–0.10 MB | 1.8–3 MB | 5.4–9 MB | Trivial |
| 7,500 | 4.5–7.5 MB | 135–225 MB | 405–675 MB | Reasonable with retention |
| 75,000 | 45–75 MB | 1.35–2.25 GB | 4.05–6.75 GB | Unsafe for a 3 GB database after cache/reference overhead |

Measure `information_schema.TABLES.DATA_LENGTH + INDEX_LENGTH` after representative load; do not approve from estimates alone. Payload cache growth is workload-specific: for example, 20,000 live rows averaging 25 KB consume roughly 500 MB before overhead. Normalized fixtures/teams/leagues are generally smaller than unbounded raw response history; standings snapshots and match-event payloads need explicit retention.

Recommended retention:

- cache rows: delete after `stale_until`; preserve no historical versions;
- leases: delete soon after expiry in bounded batches;
- `CANCELLED`: 7 days;
- `FINALISED`: 30 days at up to 7,500/day, 7 days at materially higher volume unless exported;
- `UNKNOWN_OUTCOME`/`RECONCILED`: 90 days for investigation, then archive/delete according to audit needs;
- daily aggregates and provider snapshots: 24 months (tiny), then retain monthly summaries if useful;
- maintenance records: 90 days;
- leagues/teams/seasons: retain current and referenced historical rows;
- fixtures/match detail: define product/licensing need, then archive or delete old raw payloads after 30–90 days.

A fresh provider miss normally produces multiple short transactions: cache read, lease attempt, quota reserve, dispatch, finalise/daily upsert, owner-validated cache write/release. This is acceptable at modest concurrency but amplifies latency on shared hosting. Fresh cache hits remain one indexed read. Keep the pool at five connections per Node process initially, preserve local in-flight deduplication, batch maintenance, record pool wait time, and load-test the deployed-host-to-database path. The two CPU cores and 3 GB RAM may be shared with other websites, so approval requires hPanel CPU/RAM/I/O/process baselines and peak measurements. Do not combine transactions across the provider HTTP call.

Run the read-only capacity command against isolated targets to measure `DATA_LENGTH`, `INDEX_LENGTH`, estimated rows, cache payload growth, and attempt-history growth. With the provisional 3,072 MB cap, 60% (1,843.2 MB) is a warning and 70% (2,150.4 MB) is an operational alert. The remaining ~30% is failure/rebuild/growth headroom, not normal operating capacity. Preserve daily aggregates indefinitely relative to detailed attempts; under high-volume plans, shorten finalised/cancelled attempt retention while retaining unresolved outcomes until reconciled and retaining attempt IDs long enough to preserve idempotency requirements.

## 11. Required local installations and isolated testing

Minimum developer requirements after POC approval:

- existing Node.js 22/npm toolchain;
- `mysql2` as an application dependency;
- one version-pinned MariaDB server matching the hosted major/minor as closely as possible;
- a MySQL/MariaDB CLI for inspection and migration execution;
- existing mock API-Football server;
- Playwright only for browser/end-to-end flows; it is not required for database contract tests.

Docker is optional and usually the most reproducible local choice. A native MariaDB installation is also valid. Never point automated tests at the live Hostinger application database.

Isolated procedure:

1. Create an ephemeral local MariaDB container/database and least-privilege application user from test-only credentials.
2. Apply migrations in order and run the read-only capability plus schema validation scripts.
3. Build the app once with `DATABASE_PROVIDER=mysql`, a test database, persistence enabled, and the local mock provider URL/key.
4. Start two `next start` processes on distinct ports sharing the same test database and quota scope.
5. Run the common unit/contract suite, MariaDB transaction suite, and two-process scenarios; assert provider mock call counts.
6. Inject connection refusal, latency, transaction deadlock, 429, 500, invalid JSON, timeout, process death after dispatch, and midnight/minute-boundary conditions.
7. Drop only the uniquely named ephemeral database/container after verifying its target. CI should create a new isolated database per run.

No test may use a real API-Football key. Add startup guards analogous to the existing Phase 1D script, requiring explicit `MARIADB_ISOLATED_DATABASE=true`, an allowlisted test database name prefix, and a loopback/mock provider base URL.

## 12. Migration and testing roadmap

### Phase A — account and engine proof (0.5–1 day)

Record the exact hPanel database size, user-connection limit, backup schedule/retention, restore method, Node-to-DB hostname/TLS requirement, and remote-development policy. Run the read-only inspection. Confirm Hostinger permits the necessary DDL, transactions, and session UTC setting in a disposable database.

### Phase B — abstraction and schema POC (2–4 days)

Introduce the interface and Supabase adapter without behavior change. Add `mysql2`, pool/config validation, ordered MariaDB migrations, schema validation, and MariaDB adapter. Suggested migration order:

1. `001_provider_cache.sql`
2. `002_cache_leases.sql`
3. `003_quota_locks.sql`
4. `004_usage_daily.sql`
5. `005_api_attempts.sql`
6. `006_maintenance_runs.sql`
7. indexes/constraints included with each owning table, followed by a recorded schema version table if the chosen migration runner needs one.

### Phase C — correctness and concurrency (3–5 days)

Port every current scenario. Required concurrent assertions include: one winner for an expired lease takeover; obsolete owner write rejected; new owner write succeeds; two reservations at limit yield one acquisition; duplicate attempt rejected; duplicate dispatch transitions once; duplicate finalise increments once; stale dispatched becomes unknown and remains counted; midnight dispatch rechecks the new day; minute-aged dispatch rechecks the window; newer quota observation wins; bounded cleanup rejects NULL/0/5001; and deadlock retry does not duplicate state.

### Phase D — hosted staging/load/restore (2–4 days)

Use a separate Hostinger test database and test credentials, the mock provider, and two application instances/processes. Measure p50/p95/p99 pool wait and transaction latency, connection count, query count, lock timeouts, table/index growth, and cleanup duration at projected load. Export a backup, restore to a separate test database, validate row counts/checksums and application reads, and record recovery time. Do not test restore over production.

### Phase E — optional data transfer and cutover (1–3 days)

Only if development data is worth retaining: stop writes to the source, export tables through a controlled TypeScript/CSV transform, convert UUID/time/JSON types, import in parent/dependency order, validate counts plus sampled SHA-256 canonical payload hashes, then resume testing. Operational cache and expired leases usually should not be migrated. Preserve attempt IDs and UTC instants if audit history is moved.

For a future production cutover: take a verified Supabase export, deploy code capable of both providers, enter a short write freeze/drain outstanding attempts, migrate only required durable data, switch `DATABASE_PROVIDER=mysql`, run smoke/health/cache/quota checks with the mock or a separately approved minimal provider test, and monitor. Roll back by restoring the previous application configuration and Supabase adapter; do not dual-write quota state because divergent locks make dual-write unsafe. Keep MariaDB data for analysis rather than destructively reversing it.

## 13. Backup and recovery

Before production approval, document who can trigger/export/restore backups, retention and encryption, whether restores are whole-account or per-database, expected RPO/RTO, and how a database-size or account suspension affects access. Schedule application-level logical exports if Hostinger's included restore granularity is insufficient. Encrypt exports, restrict access, and test restoration quarterly into an isolated database. A successful backup notification is not evidence of recoverability; only a checksum-validated restore rehearsal is.

## 14. Cost and architecture comparison

| Dimension | Supabase PostgreSQL | Included Hostinger MariaDB |
|---|---|---|
| Incremental monthly infrastructure | Potential separate Supabase charge; exact project tier/usage not present in repo | Likely R0 incremental while within the already-paid Business plan; verify renewal/overage terms |
| Development effort | Already implemented; still requires migration review/integration validation | Approximately 8–17 engineering days plus review, staging, and contingency |
| Reliability primitives | Mature PostgreSQL RPCs, transaction advisory locks, RLS, `jsonb`, partial indexes | Adequate InnoDB primitives, but application owns all transactions/retries and shared-host constraints |
| Performance | Managed remote API adds HTTP/PostgREST/RPC overhead | Direct protocol may reduce overhead when app and DB are colocated; shared-resource contention may offset it |
| Scaling | Clearer managed-database upgrade path and PostgreSQL ecosystem | Bound to per-database/connection/shared-host limits; likely move to Cloud/VPS/managed DB at high volume |
| Security | RLS and service-role boundary; Supabase API surface | Server-only least-privilege DB user; no RLS; direct credential/pool management |
| Operations | Supabase dashboard/backups/observability by tier | hPanel/phpMyAdmin/backups; fewer DB privileges, no event scheduler, more app-owned observability |
| Recovery | Depends on Supabase tier; verify PITR/retention | Daily backup advertised on current Business plans, but granularity/retention/RTO need account proof |
| Time to production | Shorter after existing Phase 1D gates | Longer because engine port and concurrency proof are mandatory |
| Lock-in/portability | PostgreSQL-specific RPC layer | MariaDB-specific transaction SQL; neutral TypeScript interface limits future impact |

No exact monthly saving can be calculated from the repository: neither the active Supabase tier/usage nor the Hostinger subscription generation/renewal cost is recorded. The valid financial comparison is **current Supabase invoice attributable to this app** versus **zero or stated incremental Hostinger cost plus 8–17 engineering days and higher operational ownership**. Obtain both figures before treating cost as the deciding factor.

## 15. Risks and limitations

- Exact hosted MariaDB version and subscribed limits are unverified.
- A 3 GB cap can suspend writes; quota safety then fails closed and provider freshness degrades.
- Shared-host noisy-neighbor CPU/I/O and connection pressure may dominate direct-protocol gains.
- MariaDB JSON, CHECK enforcement, upsert affected rows, `SKIP LOCKED`, and system-variable access vary by version.
- Application-managed multi-statement transactions are easier to regress than single PostgreSQL RPCs; contract and concurrency tests are release gates.
- `mysql2` pool multiplication across hot reloads or horizontally scaled processes can exhaust per-user connections.
- No database transaction may span API-Football HTTP, so the reserve/dispatch/finalise state machine remains essential.
- Provider licensing may restrict storage/reuse independently of technical capacity.
- Hostinger backup claims do not establish per-database restore granularity, RPO, or RTO.
- High-volume append history is unsuitable for a small shared database without short retention/archive.
- Current automated tests mock Supabase/static SQL; neither the reported 39 passing tests nor this review proves hosted concurrency behavior.

## 16. Estimated implementation effort and decision gates

| Workstream | Estimate |
|---|---:|
| Account/version/limit and restore proof | 0.5–1 day |
| Abstraction plus unchanged Supabase adapter | 1–2 days |
| MariaDB schema/pool/adapter/transactions | 3–5 days |
| Validation, unit, contract, and concurrency tests | 2–4 days |
| Hosted staging, load, backup/restore rehearsal | 1.5–3 days |
| Optional development-data conversion/cutover tooling | 1–2 days |
| Documentation/review/contingency | 1–2 days |
| **Total** | **8–17 engineering days; 9–19 with optional transfer** |

Production migration remains **NO-GO** until all of the following are evidenced:

- exact individual database capacity, current hPanel resource usage, TLS/connectivity, backup retention, restore process, cron frequency, and intended-website database access are recorded;
- isolated schema/capability checks pass on the hosted engine;
- all existing automated scenarios pass for both adapters;
- MariaDB two-process lease/quota tests and boundary/fault tests pass repeatedly;
- measured peak connections and p99 transaction latency have at least 50% headroom;
- projected 12-month storage with retention stays below 70% of the actual cap;
- a separate-database backup restore is checksum validated;
- security review confirms least privilege and no browser-exposed credentials;
- the migration/rollback runbook is rehearsed and approved.

At the architecture decision checkpoint, the justified result is therefore **CONDITIONAL GO for the POC architecture and NO-GO for production cutover**. The proposed row-mutex transaction design can preserve Phase 1D protections, but only exact-version concurrency and restore tests can convert that conclusion into a production GO.
