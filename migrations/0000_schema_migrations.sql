-- Migration 0000 — Schema migration tracker.
-- Bootstrap table so subsequent migrations can record their application.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version       VARCHAR(8)   PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL,
  applied_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  applied_by    VARCHAR(255) NOT NULL DEFAULT current_user,
  checksum      VARCHAR(64)  NOT NULL,
  duration_ms   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
  ON schema_migrations (applied_at DESC);
