-- The settings table (docs/proposals/table-design.md 2.14): `claude_settings` renamed, with `v` added. Expand only
-- (§data.additive): a new table seeded from the old one; claude_settings stays until the contract migration.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO settings (key, value, at, v) SELECT key, value, at, 1 FROM claude_settings;
