-- Per-scan audit log: one row per ticker per scan run, with user/profile context
CREATE TABLE IF NOT EXISTS scan_logs (
  id              BIGSERIAL PRIMARY KEY,
  user_email      TEXT,
  profile_id      INT,
  profile_name    TEXT,
  investment_period TEXT,
  ticker          TEXT,
  hurdle_rate     FLOAT,
  forensic_score  FLOAT,
  macro_score     FLOAT,
  asymmetry_score FLOAT,
  composite_score FLOAT,
  expected_return FLOAT,
  clears_hurdle   BOOLEAN,
  final_decision  TEXT,
  error           TEXT,
  scanned_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
-- Accessed via service role key only
