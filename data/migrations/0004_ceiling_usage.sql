-- The usage key of each settled ceiling hold. Additive and idempotent. Migrations only add (no ALTER), so the
-- key lives in its own row beside the hold: one row per usage key, written in the same batch that closes the hold.
CREATE TABLE IF NOT EXISTS ceiling_usage (
  key TEXT PRIMARY KEY,
  hold_id TEXT NOT NULL
);
