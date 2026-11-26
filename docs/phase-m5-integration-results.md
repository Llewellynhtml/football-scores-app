# Phase M5 MariaDB integration baseline

Validated commit: `a8a1d022a43755a12503f0e2835f659b51fee208` on `feat/phase1b-persistent-football-cache`. GitHub Actions run: [45764876592](https://github.com/Llewellynhtml/football-scores-app/actions/runs/45764876592). Preserve the remote run and its `mariadb-integration-45764876592` sanitized artifact.

## Accepted evidence

- 62/62 automated tests passed; lint, type checking, audit and whitespace checks passed.
- MariaDB 11.8.9 startup, three migrations, checksum/schema validation, restricted-user adapter contracts, quota enforcement, lease fencing and transaction recovery passed.
- Cold load: 200 requests, zero failures, exactly one synthetic upstream request; p50 17.41 ms, p95 272.20 ms, p99 275.61 ms.
- Warm load: 40 requests, zero failures, zero additional upstream requests; p50 15.31 ms, p95 24.58 ms, p99 26.16 ms.
- Both application instances received traffic; pool acquisition timeouts were zero.
- Restart persistence, controlled database-outage response, recovery, logical backup and isolated restoration passed.

These results establish isolated CI compatibility, not Hostinger production capacity, latency, IOPS, backup behavior or operational approval.
