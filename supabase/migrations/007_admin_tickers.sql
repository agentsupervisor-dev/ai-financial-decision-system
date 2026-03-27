-- Admin-managed ticker list
CREATE TABLE IF NOT EXISTS admin_tickers (
  symbol     TEXT PRIMARY KEY,
  added_by   TEXT,
  added_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_tickers ENABLE ROW LEVEL SECURITY;
-- All access via service role key only (no user-facing RLS policies)
