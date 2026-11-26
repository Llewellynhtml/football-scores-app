CREATE TABLE IF NOT EXISTS football_provider_cache (
  cache_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  stale_until DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT chk_cache_payload_json CHECK (JSON_VALID(payload)),
  CONSTRAINT chk_cache_expiry_order CHECK (stale_until >= expires_at),
  KEY football_provider_cache_stale_idx (stale_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS football_cache_leases (
  cache_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  owner_token BINARY(16) NOT NULL,
  acquired_at DATETIME(6) NOT NULL,
  lease_expires_at DATETIME(6) NOT NULL,
  CONSTRAINT chk_lease_expiry_order CHECK (lease_expires_at > acquired_at),
  KEY football_cache_leases_expiry_idx (lease_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS football_quota_locks (
  quota_scope VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  touched_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS football_api_usage_daily (
  quota_scope VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  day DATE NOT NULL,
  outbound_calls BIGINT UNSIGNED NOT NULL DEFAULT 0,
  failed_calls BIGINT UNSIGNED NOT NULL DEFAULT 0,
  successful_responses BIGINT UNSIGNED NOT NULL DEFAULT 0,
  http_errors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  provider_errors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  network_errors BIGINT UNSIGNED NOT NULL DEFAULT 0,
  timeouts BIGINT UNSIGNED NOT NULL DEFAULT 0,
  provider_limit INT UNSIGNED NULL,
  provider_remaining INT UNSIGNED NULL,
  provider_minute_limit INT UNSIGNED NULL,
  provider_minute_remaining INT UNSIGNED NULL,
  last_call_at DATETIME(6) NULL,
  quota_observed_at DATETIME(6) NULL,
  PRIMARY KEY (quota_scope, day),
  CONSTRAINT chk_usage_outcomes CHECK (failed_calls = http_errors + provider_errors + network_errors + timeouts),
  CONSTRAINT chk_usage_total CHECK (outbound_calls = successful_responses + failed_calls)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS football_api_attempts (
  attempt_id BINARY(16) NOT NULL PRIMARY KEY,
  quota_scope VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempted_at DATETIME(6) NOT NULL,
  usage_day DATE NOT NULL,
  essential BOOLEAN NOT NULL,
  reserved_daily_limit INT UNSIGNED NOT NULL,
  reserved_daily_reserve INT UNSIGNED NOT NULL,
  reserved_minute_limit INT UNSIGNED NOT NULL,
  reserved_minute_reserve INT UNSIGNED NOT NULL,
  state ENUM('RESERVED','DISPATCHED','FINALISED','UNKNOWN_OUTCOME','CANCELLED','RECONCILED') NOT NULL,
  reserved_at DATETIME(6) NOT NULL,
  reservation_expires_at DATETIME(6) NOT NULL,
  dispatched_at DATETIME(6) NULL,
  finalised_at DATETIME(6) NULL,
  outcome ENUM('success','http_error','provider_error','network_error','timeout') NULL,
  http_status SMALLINT UNSIGNED NULL,
  provider_limit INT UNSIGNED NULL,
  provider_remaining INT UNSIGNED NULL,
  provider_minute_limit INT UNSIGNED NULL,
  provider_minute_remaining INT UNSIGNED NULL,
  quota_observed_at DATETIME(6) NULL,
  CONSTRAINT chk_attempt_daily_reserve CHECK (reserved_daily_reserve <= reserved_daily_limit),
  CONSTRAINT chk_attempt_minute_reserve CHECK (reserved_minute_reserve <= reserved_minute_limit),
  CONSTRAINT chk_attempt_reservation_expiry CHECK (reservation_expires_at > reserved_at),
  KEY football_attempts_quota_day_state_idx (quota_scope, usage_day, state),
  KEY football_attempts_quota_reserved_idx (quota_scope, state, reservation_expires_at),
  KEY football_attempts_quota_dispatched_idx (quota_scope, state, dispatched_at),
  KEY football_attempts_attempted_idx (quota_scope, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
