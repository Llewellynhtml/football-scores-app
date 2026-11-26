# Hostinger staging deployment runbook

This runbook is inactive until a separate approval names the exact staging website, database and users. Replace placeholders in a private Hostinger configuration surface, never in Git.

## Configuration register

| Setting | Required value |
|---|---|
| Website | `<HOSTINGER_STAGING_WEBSITE_ID>`; access protected |
| Git ref | `feat/phase1b-persistent-football-cache` pinned to `a8a1d022a43755a12503f0e2835f659b51fee208` |
| Automatic deployment | disabled |
| Node.js | 22.x supported version; record exact patch |
| Application root | `<HOSTINGER_APPLICATION_ROOT>` |
| Build/start | Hostinger-managed install; build `npm run build`; platform-managed Next.js entry. Never run migrations here. |
| Database | independently approved `<HOSTINGER_PREFIX>_football_stage_m6` at `127.0.0.1:3306` |
| Users | separate `<MIGRATION_USER>` and `<RUNTIME_USER>` where supported |
| Provider | `DATABASE_PROVIDER=mysql`, `FOOTBALL_PERSISTENCE_ENABLED=true` |
| Pool | `MYSQL_CONNECTION_LIMIT=5`; acquisition timeout bounded |
| Synthetic provider | exact approved HTTP loopback origin or access-protected HTTPS origin; dedicated synthetic key and response marker |
| Quota scope | `hostinger-stage-m6-<UNIQUE_ID>` |
| TLS | required and certificate verified; record Hostinger CA/connection policy |

Server-only variables include the connection values plus separately recorded approved database/user, hosted target and operation authorizations, persistence/pool settings, exact synthetic origin/mode/key, isolated quota scope, and diagnostics secrets. None may use `NEXT_PUBLIC_`. Supabase and real API-Football variables must be absent.

## Supported-execution assessment

Hostinger Business/Cloud runs npm commands as part of managed Node deployments and does not provide manual npm execution over SSH. Therefore:

| Operation | Prepared approach | Status before hPanel confirmation |
|---|---|---|
| Application build/start | Hostinger deployment settings | supported; migrations excluded |
| Migration | private, explicitly authorized one-off job using migration user and hosted guard | blocker: supported job mechanism/internal DB access unverified |
| Read-only validation/capacity | private one-off job producing sanitized logs | blocker: mechanism unverified |
| Maintenance | bounded external schedule or private one-off job, never a public route | blocker: scheduler/command support unverified |
| Loopback mock | separately supervised private Node process | blocker: second process/port support unverified |
| HTTPS synthetic app | separate access-protected staging website | feasible design; access controls still unverified |
| Logical backup/restore | hPanel/phpMyAdmin export and restore into a separate disposable database | blocker: retention and alternate-target restore unverified |

Do not put migrations, validation or maintenance in the normal build/start command, and do not create public operational endpoints.

## Controlled migration

1. Reconfirm automatic deployment is disabled and production is untouched.
2. Capture idle resource metrics and exact selected database identity. Require an empty schema or the exact approved migration tables only.
3. Create and checksum an initial logical backup through supported hPanel tooling; restore it into a second disposable staging database only after alternate-target behavior is confirmed.
4. Through the separately approved private one-off mechanism, enable the hosted guard with independently recorded database/user values. Verify `SELECT DATABASE(), CURRENT_USER()` and the schema allowlist before DDL.
5. Verify every recorded migration checksum and ordered history. Apply files lexically; never edit applied SQL. Re-execution must report every migration unchanged. Checksum-tampering tests are CI-only and must never run against Hostinger.
6. Validate all seven tables, InnoDB engines, indexes, foreign keys/check constraints and three migration checksum records.
7. Switch to the restricted runtime user. Prove required reads/writes and prove DDL, grant and unrelated-schema access fail.
8. Set and read back UTC, `READ-COMMITTED`, strict SQL mode, InnoDB strict mode and five-second lock wait timeout on application connections.
9. Deploy the pinned build with the synthetic provider only. Start at one application instance and execute the bounded performance plan.
10. Save sanitized results and revoke/disable migration access.

Abort immediately on identity mismatch, unexpected tables, checksum drift, missing TLS, real-provider configuration, production/Supabase variables, excessive privileges, resource thresholds, or production impact.
