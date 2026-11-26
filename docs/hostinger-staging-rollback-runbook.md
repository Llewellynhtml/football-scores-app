# Hostinger staging rollback and recovery runbook

This procedure applies only to the disposable staging website/database. It must never overwrite production.

1. Stop new staging traffic by disabling the staging application or access route; leave the shared database service running.
2. Record UTC time, commit, configuration fingerprint, sanitized error, hPanel resources, connection count and table sizes.
3. Disable migration/maintenance credentials and preserve the failing database read-only for analysis.
4. Using confirmed hPanel restoration tooling, restore the verified pre-migration logical backup into a **new** disposable database with a distinct independently approved staging name. If alternate-target restore is unsupported, stop and escalate; never overwrite production.
5. Verify the restored database identity, migration checksums, tables/indexes/constraints, row counts and representative cache payload digest before any application connection.
6. Point only the staging website at the restored database through the private Hostinger environment interface. Confirm production environment variables are unchanged.
7. Start one staging instance using the synthetic provider; perform read-only health, one fixture, warm-cache and quota checks.
8. Retain both databases until the incident review completes, then request explicit approval for cleanup.

If application rollback alone is sufficient, pin the previous validated staging commit and restore its matching private configuration. Do not copy divergent quota/attempt state into Supabase or production. Record actual recovery time and data-loss window against the agreed RTO/RPO.

Before deployment approval, verify Hostinger's backup retention, whether a single database can be selected, whether restoration can target a different database, whether application/database credentials are restored, and whether the operation affects other websites in the subscription.
