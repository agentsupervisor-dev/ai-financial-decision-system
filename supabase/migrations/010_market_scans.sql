-- Daily AI scan results per ticker — scores only, no hurdle/decision
-- Decision is computed client-side per user's profile hurdle rate
CREATE TABLE IF NOT EXISTS market_scans (
  id               BIGSERIAL PRIMARY KEY,
  symbol           TEXT NOT NULL,
  universe         TEXT NOT NULL,
  forensic_score   FLOAT,
  macro_score      FLOAT,
  asymmetry_score  FLOAT,
  composite_score  FLOAT,
  confidence       FLOAT,
  expected_return  FLOAT,
  decision_summary TEXT,
  error            TEXT,
  scanned_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast latest-per-ticker lookup
CREATE INDEX IF NOT EXISTS idx_market_scans_symbol_scanned
  ON market_scans (symbol, scanned_at DESC);

ALTER TABLE market_scans ENABLE ROW LEVEL SECURITY;
-- All authenticated users can read scan results
CREATE POLICY "Authenticated users can read market_scans"
  ON market_scans FOR SELECT
  USING (auth.role() = 'authenticated');
-- Only service role can insert (cron job uses service role key)
