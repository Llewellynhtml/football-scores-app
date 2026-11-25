# Phase M3 GitHub Actions MariaDB testing

## Status

The workflow is prepared locally at `.github/workflows/mariadb-integration.yml`. It has not been committed, pushed, or executed, so every service-container, integration, concurrency, load, outage, and restore result remains **pending**. Local static verification does not prove the remote workflow passes.

## Remote architecture

One GitHub-hosted Ubuntu runner executes Node.js 22 and an official `mariadb:11.8.9-ubi9` service container. The exact patch tag is available in the Docker Official Image catalogue. Port 3306 is published to runner loopback. All credentials are synthetic job constants and the disposable database is named `football_scores_test_ci`, satisfying the existing Phase M2 guard.

The workflow applies optional container constraints of two CPUs and 3 GiB RAM. It configures UTC, READ COMMITTED, strict SQL mode, and a 20-second server idle timeout; application sessions independently enforce and verify UTC, READ COMMITTED, strict mode, InnoDB strict mode, and a five-second lock wait. These reproduce selected Hostinger properties but do not reproduce Hostinger's shared storage, IOPS, network, backup platform, or noisy-neighbor behavior.

The API-Football endpoint is always `127.0.0.1:4310` with the literal `integration-test-key`. Supabase variables are absent. The job has read-only repository permissions and cannot deploy.

## Workflow sequence

The job timeout is 35 minutes and the service has bounded health checks. It executes:

1. checkout and Node 22 setup;
2. configure and record simulated server settings;
3. `npm ci`;
4. lint, typecheck, and the database-independent suite;
5. pre-migration identity/session validation with schema expectation disabled;
6. ordered checksum migrations;
7. post-migration validation requiring every expected table;
8. direct connection tests and actual MariaDB adapter contract tests;
9. capacity report;
10. Next.js build while the loopback mock is active;
11. disposable-data reset so the concurrency test begins cold;
12. two independent Next.js processes, bounded identical-key load, mock request-count assertion, application restart/persistent-cache check, and database-pause fail-closed check;
13. post-load capacity report;
14. logical dump, restore to `football_scores_test_restore_ci`, table row-count comparison, and representative cache-payload digest comparison;
15. sanitized artifact upload even on failure.

The adapter contract runner verifies expired lease takeover, rejection of an obsolete owner, guarded cache persistence, one-winner concurrent quota reservation, duplicate dispatch rejection, idempotent finalisation, UNKNOWN_OUTCOME conversion, and UTC-day dispatch reassignment. Existing unit tests cover provider timeout classification, stale fallback, fully expired cache rejection, malformed payloads, and request-level failure behavior.

## Required environment

All variables are defined inside the workflow and are synthetic. Important safety values are:

```text
MARIADB_ISOLATED_DATABASE=true
DATABASE_PROVIDER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_DATABASE=football_scores_test_ci
API_FOOTBALL_BASE_URL=http://127.0.0.1:4310
API_FOOTBALL_KEY=integration-test-key
API_SPORTS_KEY=integration-test-key
```

The pool is fixed at five connections with two idle, a 10-second client idle timeout, and five-second connect/acquisition/lock waits. The CI quota is one daily and one per minute so a second distinct outbound request is denied. The load is initially 200 requests at concurrency 10, capped by the script at 10,000/50.

No GitHub repository secrets are required. Do not replace synthetic values with hosted credentials.

## Running the workflow

After explicit approval to commit and push, keep PR #2 draft and use either:

- the pull-request trigger when relevant MariaDB/workflow files change; or
- GitHub Actions → **MariaDB integration** → **Run workflow**.

Review the job logs and download the `mariadb-integration-<run-id>` artifact. A green workflow is required before local integration can be considered remotely validated. Do not rerun failed steps with relaxed safety variables.

## Reports and artifacts

The artifact contains only generated logs/reports under `artifacts/mariadb/`: server configuration, static checks, pre/post validation, migration results, direct integration and adapter contract results, build/application logs, load diagnostics, capacity reports, restart persistence, backup/restore comparison, and remaining blockers. The SQL dump is created in the runner temporary directory and deleted after restore; it is not uploaded. Environment files and credentials are not artifacts.

## Process and failure safety

The two-instance step records every PID and installs an EXIT trap that kills both Next.js processes and the mock. The trap also restarts MariaDB if an outage assertion fails while the service is stopped. GitHub's disposable service container is destroyed with the job. The workflow concurrency group cancels superseded runs on the same ref.

Database outage testing stops only the disposable service. A fresh request must fail and the mock-provider request counter must remain unchanged, verifying that required shared quota coordination fails closed. MariaDB is restarted, health-checked, revalidated, and queried through the already-running application before later steps.

## Troubleshooting

- **Service never becomes healthy:** inspect the service-container log; confirm the exact `11.8.9-ubi9` tag still exists and healthcheck syntax is supported. Do not change versions silently.
- **Pre-validation version failure:** confirm the resolved image prints `11.8.x-MariaDB`; retain the failing report.
- **Session validation failure:** inspect which read-back value differs. Do not remove the assertion; adjust only the disposable service configuration if it is a simulation issue.
- **Migration checksum failure:** an applied migration changed. Restore the original file and create a new ordered migration.
- **Adapter runner import failure:** confirm the command retains `--conditions=react-server --import tsx`, required for server-only modules.
- **Load provider count above one:** inspect both application logs, lease timing, pool waits, and the mock stats. This is a correctness failure, not a threshold to raise casually.
- **Outage request succeeds or mock count changes:** shared quota coordination did not fail closed; stop the migration track.
- **Restore mismatch:** retain row-count/digest reports and do not approve backup readiness.
- **Artifact contains sensitive material:** cancel the run and remove the artifact. The workflow must use synthetic values only.

## Performance interpretation

The load report includes response latency, failures, mock-provider consumption, process-local database operation/transaction latency, pool wait and activity, cache-hit ratio, operations per observed request, and table/index sizes. GitHub runner results detect regressions and contention; they do **not** establish Hostinger IOPS capacity or production latency. Larger loads should be manually dispatched by changing bounded workflow inputs in a separately reviewed change, not by removing caps.

## Hosted staging prerequisites and production gates

Before hosted staging: confirm the individual database limit, intended-site connectivity, backup retention/granularity, restore procedure, cron frequency, and a synthetic-only staging database. Correlate a bounded staging interval with hPanel CPU/RAM/I/O/IOPS/process graphs.

Production remains **NO-GO** until this workflow has passed, failures have been reviewed, an independently isolated hosted-staging run passes, Hostinger backup restoration is rehearsed, storage projections retain 30% headroom, and rollback/security/operations reviews are approved. Supabase remains available as the explicit alternative adapter.
