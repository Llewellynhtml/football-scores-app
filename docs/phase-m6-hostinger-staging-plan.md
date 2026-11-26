# Phase M6 Hostinger staging plan

## Boundary and target

Create a new access-protected staging website and disposable MariaDB database inside the existing Business Web Hosting subscription. Pin deployment to commit `a8a1d022a43755a12503f0e2835f659b51fee208`; keep automatic deployment disabled. Do not alter the production website, its environment, Supabase, or any existing database. Previously observed 50 GB disk, 3 GB RAM, two cores, 600,000 inodes, 512 shared IOPS, MariaDB 11.8.9, 75 user connections and 20-second idle timeout must be reconfirmed.

Compatibility basis: Hostinger documents `127.0.0.1` for an internally hosted Node.js application's database connection and documents that Business/Cloud npm commands run through deployment rather than manual SSH: [database connection](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/), [Node.js deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Approval gates in hPanel

Record screenshots or exports showing:

1. staging website identity, subscription association, access protection and automatic deployment disabled;
2. MariaDB version, internal `127.0.0.1:3306` connectivity, TLS behavior for that internal path, exact prefixed database/user names and individual storage limit;
3. whether two users can be assigned distinct privileges to one database;
4. allowed remote/application database connectivity and source restrictions;
5. Node.js version, process count, port binding, persistent-process and additional-process support;
6. idle CPU, RAM, I/O/IOPS, processes and connections;
7. backup frequency, retention, database-only restore, alternate-database restore and recovery behavior.

Do not enter secrets into repository files or screenshots.

## Identity and permissions

Use exact recorded placeholders until hPanel assigns names:

- database: `<HOSTINGER_PREFIX>_football_stage_m6`
- migration user: `<HOSTINGER_PREFIX>_football_stage_migrator`, temporarily granted only the DDL/DML privileges required by migrations;
- runtime user: `<HOSTINGER_PREFIX>_football_stage_runtime`, restricted to the application tables and required `SELECT`, `INSERT`, `UPDATE`, and bounded `DELETE` operations; no DDL, grant or database creation privileges.

Before any mutation, record an independently approved database and user, then connect read-only and verify both `DATABASE()` and `CURRENT_USER()`. The connection variables cannot approve themselves. Hostinger's documented internal application path is exactly `127.0.0.1`; other loopback aliases and external hosts remain rejected. Refuse identities containing `prod`, `production` or `live`, unexpected tables, Supabase variables, or any target mismatch. Revoke or disable the migration user after verification if supported. If separate users are unsupported, record that blocker and require a time-bounded privilege procedure before GO.

The local `football_scores_test_*` loopback guard remains unchanged. The separate hosted guard is disabled unless `MARIADB_HOSTED_STAGING_AUTHORISED=true`; preparation uses only placeholder credentials. Wiring that guard into hosted commands requires a separately reviewed execution entry point before deployment.

## Synthetic provider architecture

Preferred: `synthetic-loopback`, a private HTTP mock bound only to an independently approved `127.0.0.1:<port>` origin and supervised separately from Next.js. No administration route may be public. Alternative: `synthetic-https`, a separately access-protected application at one exact approved HTTPS origin. The dispatch boundary forbids redirects, real-provider hosts/credentials and non-staging quota scopes, and requires a synthetic response marker. The app fails closed if any check fails.

If Hostinger permits only one Node process or no internal port, the HTTPS application may expose fixture responses only. Destructive reset/statistics controls must be absent from its public surface; use private platform logs or an independently protected control plane. Neither mode contains a fallback to the real provider.

## Managed-hosting command constraint

Business/Cloud npm commands are deployment-managed and cannot be invoked manually through SSH. Migrations, validation, capacity and maintenance must not be added to normal build or application startup. Until hPanel/Hostinger support confirms a private, auditable one-off job mechanism with internal database access, those operations are hosting blockers. Backup/export and alternate restoration should use supported hPanel database/backup tooling; exact granularity remains unverified.

## Capacity forecast

Planning assumptions—not measured storage—use 1 KiB per detailed attempt including indexes, 30-day detailed retention, 10% maintenance/index slack, 50 MB bounded cache, and small daily aggregates. Actual average row and cache payload sizes must replace these assumptions after staged samples.

| Plan assumption | Requests/day | 30-day attempt base | With 10% slack + 50 MB cache | Initial assessment at provisional 3,072 MB |
|---|---:|---:|---:|---|
| Free | 100 | 2.9 MB | about 53 MB | acceptable |
| Pro | 7,500 | 219.7 MB | about 292 MB | acceptable, measure growth |
| Ultra | 75,000 | 2,197 MB | about 2,467 MB | exceeds 70% operating ceiling; reduce retention/row size or confirm more capacity |

Maintain at least 30% headroom. Warn at 60%, alert/stop nonessential growth at 70%. Backup storage may be outside the database quota, but must not be assumed so.

## Decision

**NO-GO for actual staging deployment** until hPanel values, separate-user capability, synthetic-provider process model, TLS, exact database identity/capacity, and backup/alternate restore behavior are confirmed. Code and documentation preparation may proceed without hosted access.
