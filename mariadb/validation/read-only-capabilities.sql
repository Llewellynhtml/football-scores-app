-- Read-only inspection: safe for the hosted database, subject to account permissions.
SELECT VERSION() AS version, @@version_comment AS version_comment;
SELECT @@session.time_zone AS session_time_zone,
       @@global.time_zone AS global_time_zone,
       @@session.transaction_isolation AS session_isolation,
       @@session.sql_mode AS session_sql_mode,
       @@session.innodb_strict_mode AS session_innodb_strict_mode,
       @@session.innodb_lock_wait_timeout AS session_lock_wait_timeout;
SELECT @@max_connections AS global_max_connections,
       @@max_user_connections AS max_user_connections,
       @@max_allowed_packet AS max_allowed_packet,
       @@wait_timeout AS wait_timeout,
       @@max_statement_time AS max_statement_time,
       @@event_scheduler AS event_scheduler;
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
