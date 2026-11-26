CREATE TABLE IF NOT EXISTS football_maintenance_runs (
  run_id BINARY(16) NOT NULL PRIMARY KEY,
  operation VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  started_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  affected_rows INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('RUNNING','SUCCEEDED','FAILED') NOT NULL,
  error_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  details_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  CONSTRAINT chk_maintenance_details_json CHECK (details_json IS NULL OR JSON_VALID(details_json)),
  KEY football_maintenance_started_idx (started_at),
  KEY football_maintenance_status_idx (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
