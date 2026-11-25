# MariaDB migration and rollback runbook

## Current authorization boundary

This runbook is prepared but not authorized for the hosted database. Phase M1 stops before hosted connection, migration, configuration changes, maintenance activation, or deployment.

## Preflight gates

Record the actual individual database storage allowance, backup retention/granularity, remote connectivity/TLS policy, cron minimum frequency, intended-website access, and restore RPO/RTO. Capture hPanel Resources Usage for CPU, RAM, I/O, and processes at idle and peak. Confirm a fresh backup and restore it to a separate database. Confirm `mariadb/validation/read-only-capabilities.sql` reports MariaDB 11.8, InnoDB, UTC-compatible sessions, READ COMMITTED, and expected limits.

Create a separate staging database/user with only required schema/data privileges. Keep credentials server-only. Calculate total connections as application instances times pool limit plus migration/maintenance headroom; remain well below 75.

## Isolated apply procedure

1. Take a logical backup and record its SHA-256 checksum.
2. Set `MARIADB_ISOLATED_DATABASE=true` only for a database matching `football_scores_test_*` or `football_scores_dev_*`.
3. Run `npm run db:mariadb:migrate`. Files apply lexically. The runner records SHA-256 checksums and refuses changed applied migrations.
4. Run the read-only validation SQL and check all operational tables are InnoDB with expected indexes/constraints.
5. Run `npm run test:mariadb:integration`, the complete unit suite, type check, build, and two-process tests with the loopback mock provider.
6. Measure table/index bytes, pool wait, transaction latency, lock timeouts, query counts, and cleanup duration.
7. Run `npm run db:mariadb:capacity`; until hPanel confirms otherwise, use 3,072 MB, warning at 60% and alert at 70%. Do not approve if projected normal operation exceeds 70%.

Never edit an applied migration. Add a new ordered migration.

## Optional Supabase data transfer

Do not migrate active leases or expired cache rows. Usually omit cache entirely. If audit history is required, freeze source writes, export daily usage and attempts, transform UUIDs to 16-byte values and timestamps to UTC `DATETIME(6)`, import in batches, then compare counts and canonical payload hashes. Scope legacy daily aggregates explicitly. Resume only after validation.

Do not dual-write quota state. Two databases cannot share the same transaction lock, so dual-writing would create false confidence and divergent enforcement.

## Future controlled cutover

1. Deploy code supporting both providers while still selecting Supabase.
2. Drain outstanding requests and enter a brief persistence write freeze.
3. Take and verify a final Supabase backup/export if data is retained.
4. Apply/validate MariaDB migrations in the approved target.
5. Set Hostinger server-only MariaDB variables and explicitly change `DATABASE_PROVIDER=mysql`.
6. Start one instance, verify sanitized health/configuration and mock-backed cache/quota flows, then restore normal instance count.
7. Monitor pool use, lock latency, deadlocks, errors, storage growth, and quota state. Do not invoke real API-Football solely as a migration test without separate approval.

## Rollback

Stop or drain application writes, restore the prior application configuration with `DATABASE_PROVIDER=supabase`, and restart. Validate Supabase health and request behavior. Do not copy partially diverged MariaDB quota rows back automatically. Preserve MariaDB for incident analysis. If Supabase data was frozen during cutover, reconcile the cutover window explicitly before declaring rollback complete.

Database DDL rollback is restore-based, not ad hoc `DROP` statements. Restore into a separate database first, verify checksums and row counts, then follow the approved Hostinger restore procedure.

## Maintenance

Because hosted events are off, schedule an external command only after review. `npm run db:mariadb:maintenance -- cache 500` (or `leases`, `cancelled`, `finalised`) requires `MARIADB_MAINTENANCE_ENABLED=true`, rejects invalid/NULL-equivalent bounds, and executes one short transaction. Capture outcome in operational logging and eventually in `football_maintenance_runs`. UNKNOWN_OUTCOME reconciliation is intentionally not automated in M1; it requires an approved provider/audit policy.

Run capacity inspection as a separate read-only external job. A warning should trigger retention/cleanup review; an alert should stop nonessential growth and require operator action. Do not respond by launching uncontrolled background cleanup or broad unindexed deletes.
