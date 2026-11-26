# Phase M2 local MariaDB setup and test runbook (Windows CMD)

This runbook is preparation only. Do not run migration commands until MariaDB 11.8.9 is installed and the identity-only validation succeeds. Use **Command Prompt (`cmd.exe`)**, not PowerShell. Never paste Hostinger or real API-Football credentials into these windows.

## 1. Install and verify MariaDB

Install MariaDB Community Server 11.8.9 manually with the command-line client. Open a new CMD window and verify the binaries:

```cmd
node --version
npm --version
git --version
mariadb --version
where mariadb
```

Expected MariaDB version: `11.8.9-MariaDB`. If `mariadb` is not on PATH, use the full executable path, normally similar to `"C:\Program Files\MariaDB 11.8\bin\mariadb.exe"`.

## 2. Create the dedicated database and users

Connect as the local administrative user:

```cmd
mariadb -h 127.0.0.1 -P 3306 -u root -p
```

At the MariaDB prompt run the following, replacing both password placeholders with unique **local-only** passwords:

```sql
CREATE DATABASE football_scores_test_m2
  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

CREATE USER 'football_m2_migrator'@'localhost'
  IDENTIFIED BY 'replace-local-migrator-password';
CREATE USER 'football_m2_app'@'localhost'
  IDENTIFIED BY 'replace-local-app-password';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
  ON football_scores_test_m2.* TO 'football_m2_migrator'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON football_scores_test_m2.* TO 'football_m2_app'@'localhost';

FLUSH PRIVILEGES;
SHOW GRANTS FOR 'football_m2_migrator'@'localhost';
SHOW GRANTS FOR 'football_m2_app'@'localhost';
EXIT;
```

Do not grant global privileges, `GRANT OPTION`, `FILE`, `PROCESS`, `SUPER`, or access to another database.

## 3. Create one isolated CMD environment

Open a new CMD window at the repository root. Clear common hosted/real credential variables first, then set only local values:

```cmd
cd /d C:\Users\User015\Desktop\football-scores-app
set SUPABASE_URL=
set SUPABASE_SECRET_KEY=
set SUPABASE_SERVICE_ROLE_KEY=
set API_SPORTS_KEY=
set MARIADB_ISOLATED_DATABASE=true
set DATABASE_PROVIDER=mysql
set FOOTBALL_PERSISTENCE_ENABLED=true
set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=3306
set MYSQL_DATABASE=football_scores_test_m2
set MYSQL_USER=football_m2_migrator
set MYSQL_PASSWORD=replace-local-migrator-password
set MYSQL_CONNECTION_LIMIT=5
set MYSQL_MAX_IDLE=2
set MYSQL_IDLE_TIMEOUT_MS=10000
set MYSQL_QUEUE_LIMIT=50
set MYSQL_CONNECT_TIMEOUT_MS=5000
set MYSQL_ACQUIRE_TIMEOUT_MS=5000
set MYSQL_LOCK_WAIT_TIMEOUT_SECONDS=5
set API_FOOTBALL_BASE_URL=http://127.0.0.1:4310
set API_FOOTBALL_KEY=integration-test-key
set API_SPORTS_KEY=integration-test-key
set FOOTBALL_QUOTA_SCOPE=mariadb-m2-local-test
set CRON_SECRET=local-m2-diagnostics-only
set MARIADB_LOAD_CRON_SECRET=local-m2-diagnostics-only
set MARIADB_LOAD_MAX_PROVIDER_REQUESTS=1
set MARIADB_DATABASE_CAPACITY_MB=3072
set MARIADB_CAPACITY_WARNING_PERCENT=60
set MARIADB_CAPACITY_ALERT_PERCENT=70
```

The placeholder template is `.env.mariadb.local.example`. If values are saved, save them only as `.env.mariadb.local`, which is ignored by Git. The scripts do not automatically load this file; explicit CMD variables make inheritance visible.

Check identity variables without printing passwords:

```cmd
echo %MYSQL_HOST%
echo %MYSQL_DATABASE%
echo %MYSQL_USER%
echo %API_FOOTBALL_BASE_URL%
```

They must show loopback, `football_scores_test_m2`, the local user, and the loopback mock.

## 4. Identity and session preflight — no migration

This is the first permitted connection after installation:

```cmd
npm run db:mariadb:validate
```

It refuses non-loopback hosts/non-test names, verifies the selected database and MariaDB 11.8 identity, applies and reads back the session-only UTC, READ COMMITTED, `STRICT_TRANS_TABLES`, InnoDB strict, and five-second lock-wait settings, and lists existing tables. Stop if any assertion fails.

## 5. Apply migrations only after preflight review

```cmd
npm run db:mariadb:migrate
npm run db:mariadb:validate
npm run db:mariadb:capacity
```

The migration runner records checksums and refuses modified applied migrations. Capacity should be near zero in the fresh database.

After migration, switch to the restricted runtime user in the same CMD window:

```cmd
set MYSQL_USER=football_m2_app
set MYSQL_PASSWORD=replace-local-app-password
npm run db:mariadb:validate
```

## 6. Database-independent and direct integration tests

```cmd
npm run typecheck
npm run lint
npm test
npm run test:mariadb:integration
```

The integration test verifies session settings, rollback, concurrent lease ownership, and reconnect after 21 seconds idle. It uses no provider network call.

## 7. Start the local mock and two application instances

Open **CMD window A**, set `MOCK_API_FOOTBALL_PORT=4310`, then:

```cmd
cd /d C:\Users\User015\Desktop\football-scores-app
set MOCK_API_FOOTBALL_PORT=4310
set MOCK_API_FOOTBALL_DELAY_MS=150
npm run mock:football
```

In the original configured CMD window, build once while the mock is running:

```cmd
npm run build
```

Open **CMD windows B and C**. Repeat the safe variables from section 3 with the restricted app user in each; do not rely on machine-wide variables. Then start:

```cmd
rem Window B
cd /d C:\Users\User015\Desktop\football-scores-app
npm run start -- -p 3213
```

```cmd
rem Window C
cd /d C:\Users\User015\Desktop\football-scores-app
npm run start -- -p 3214
```

## 8. Two-instance concurrency and bounded load test

From the original configured window:

```cmd
set MARIADB_LOAD_APP_URLS=http://127.0.0.1:3213,http://127.0.0.1:3214
set MARIADB_LOAD_MOCK_URL=http://127.0.0.1:4310
set MARIADB_LOAD_REQUESTS=200
set MARIADB_LOAD_CONCURRENCY=10
set MARIADB_LOAD_PATH=/api/fixtures?date=2026-11-25
npm run test:mariadb:load
npm run db:mariadb:capacity
```

The load script refuses non-loopback URLs, caps requests/concurrency, captures authenticated diagnostics from both processes before/after, and fails when the identical-key run consumes more than one mock-provider request. It reports latency, database operation counters, transaction latency, pool wait, cache hits, and mock consumption.

During the run, find the two Node PIDs in another CMD window and capture process resources:

```cmd
tasklist /fi "imagename eq node.exe"
powershell -NoProfile -Command "Get-Process -Id PID1,PID2 | Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64,Threads,Handles"
```

Record measurements before, during, and after. A later approved hosted-staging run should record the exact wall-clock interval and correlate it with hPanel CPU, memory, I/O, IOPS, process, and fault graphs. Do not run this against production.

## 9. Optional bounded maintenance test

Only on this isolated local database:

```cmd
set MARIADB_MAINTENANCE_ENABLED=true
npm run db:mariadb:maintenance -- cache 100
npm run db:mariadb:maintenance -- leases 100
set MARIADB_MAINTENANCE_ENABLED=
```

The command rejects non-loopback/non-test identities and limits outside 1–5,000.

## 10. Stop and review

Stop both app processes and the mock with `Ctrl+C`. Do not drop the database until results are reviewed. Record all command results, MariaDB version, table/index sizes, pool waits, transaction p95/p99, mock request count, Node CPU/RAM, and any lock timeout/deadlock.

Do not run `test:phase1d:concurrency` in this MariaDB workflow: that script is intentionally Supabase/PostgreSQL-specific.
