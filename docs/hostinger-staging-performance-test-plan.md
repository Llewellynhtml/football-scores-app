# Hostinger staging performance test plan

Run only after deployment approval and capture hPanel resource graphs immediately before, during and after each stage. Hold each stage long enough to observe delayed I/O flushing; review results before advancing.

All commands must run through an explicitly supported Hostinger deployment/job/scheduler mechanism. Manual npm execution over SSH is not available on Business/Cloud hosting. Do not substitute public test or maintenance endpoints.

| Stage | Workload | Required evidence before advancing |
|---|---|---|
| 0 | 10-minute idle baseline | CPU, RAM, I/O/IOPS, processes and DB connections stable |
| 1 | read-only identity/session/capacity queries | correct database/session, no errors |
| 2 | one synthetic fixture request | valid fixture, one provider request, quota/attempt/cache rows correct |
| 3 | cold then warm correctness | cold exactly one provider request; warm zero additional |
| 4 | 20 sequential requests | zero errors, stable memory/connections, cache-hit growth |
| 5 | 20 requests at concurrency 2 | no pool timeout, acceptable locks/latency |
| 6 | 50 requests at concurrency 5 | proceed only if prior metrics retain headroom |
| 7 | optional 100 requests at concurrency 5 | separately approve if shared IOPS remains healthy |
| 8 | application restart | cached fixture persists; no extra provider request |
| 9 | logical backup and alternate-database restore | checksums, tables, counts and representative payload match |

For every active stage record response p50/p95/p99/max, failures/throttling, cache hits and ratio, provider count, DB operations/request, pool active/pending/acquisition waits/timeouts, connection and transaction latency, lock/deadlock errors, table/index bytes, CPU, RAM, I/O/IOPS, processes and connection count. Correlate timestamps in UTC with hPanel graphs. Do not equate one SQL query with one physical IOPS operation.

## Acceptance and abort criteria

Accept only if synthetic content and provider counts are exact; error rate is zero; acquisition timeouts, deadlocks and lock-timeout errors are zero; connections stay safely below 75 including maintenance headroom; memory/process counts return near baseline; capacity is below 60%; and no sustained resource saturation is observed.

Abort the current and all higher stages if any real-provider destination/key appears, production traffic/resources change, database identity changes, checksum/constraint validation fails, HTTP/DB errors occur, pool acquisition times out, connections exceed 50, database reaches 60% capacity, CPU exceeds 80% for five minutes, memory exceeds 75%, IOPS remains at its limit for two consecutive measurement intervals, process limits approach 80%, or p95 exceeds 1 second for two stages. Stop the application workload—never stop or pause Hostinger's shared database service.
