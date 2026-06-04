-- Add price columns to market_scans so price is captured at scan time
-- Used as fallback when live FMP price fetch is unavailable
ALTER TABLE market_scans ADD COLUMN IF NOT EXISTS price      FLOAT;
ALTER TABLE market_scans ADD COLUMN IF NOT EXISTS change_pct FLOAT;
