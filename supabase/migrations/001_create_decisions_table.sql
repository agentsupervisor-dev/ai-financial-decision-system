-- AI Financial Decision System
-- Migration 001: Create decisions table
--
-- Run this in your Supabase project:
--   Dashboard > SQL Editor > New query > Paste & Run
-- Or via Supabase CLI:
--   supabase db push

CREATE TABLE IF NOT EXISTS decisions (
  id                    BIGSERIAL PRIMARY KEY,
  ticker                TEXT        NOT NULL UNIQUE,
  company_name          TEXT,
  sector                TEXT,
  market_cap            BIGINT,
  hurdle_rate           FLOAT,
  recommendation        TEXT        NOT NULL DEFAULT 'PENDING'
                          CHECK (recommendation IN ('PENDING', 'BUY', 'HOLD', 'REJECT')),
  composite_score       FLOAT,
  forensic_score        FLOAT,
  macro_score           FLOAT,
  asymmetry_score       FLOAT,
  confidence            FLOAT,
  expected_return       FLOAT,
  triangulation_summary TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for fast status filtering (used by /api/analyze to fetch PENDING rows)
CREATE INDEX IF NOT EXISTS idx_decisions_recommendation
  ON decisions (recommendation);

-- Index for ticker lookups
CREATE INDEX IF NOT EXISTS idx_decisions_ticker
  ON decisions (ticker);
