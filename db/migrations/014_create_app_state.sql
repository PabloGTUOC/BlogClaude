-- Tiny key/value store for server bookkeeping (e.g. when the last engagement
-- digest email was sent), so state survives API restarts.
CREATE TABLE IF NOT EXISTS app_state (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
