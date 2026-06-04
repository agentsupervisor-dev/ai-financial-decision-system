-- Investment type allocations per strategy row
CREATE TABLE IF NOT EXISTS strategy_investments (
  id              BIGSERIAL PRIMARY KEY,
  strategy_id     BIGINT NOT NULL REFERENCES portfolio_strategies(id) ON DELETE CASCADE,
  investment_type TEXT   NOT NULL,
  allocation_pct  FLOAT  NOT NULL DEFAULT 0,
  sort_order      INT    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_strategy_investments_strategy ON strategy_investments (strategy_id, sort_order);

ALTER TABLE strategy_investments ENABLE ROW LEVEL SECURITY;

-- Users can read/write investments that belong to their own strategies
-- (strategy → portfolio_strategies → user_id)
CREATE POLICY "Users manage own strategy_investments"
  ON strategy_investments
  USING (
    strategy_id IN (
      SELECT id FROM portfolio_strategies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    strategy_id IN (
      SELECT id FROM portfolio_strategies WHERE user_id = auth.uid()
    )
  );

-- ── Investment type → universe mapping (reference table) ─────────────────────

CREATE TABLE IF NOT EXISTS investment_type_universe (
  investment_type TEXT PRIMARY KEY,
  universe_key    TEXT,   -- NULL for non-equity types (Treasury bond)
  label           TEXT
);

ALTER TABLE investment_type_universe ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read this reference table (it's a lookup, no user data)
CREATE POLICY "Authenticated users can read investment_type_universe"
  ON investment_type_universe FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update (done at migration time only)

INSERT INTO investment_type_universe (investment_type, universe_key, label) VALUES
  ('Jumbo cap',     'mega10',     'Top 10 mega-cap stocks'),
  ('Mega cap',      'mega10',     'Top 10 mega-cap stocks'),
  ('Large cap',     'sp500',      'S&P 500 top 30'),
  ('Mid cap',       'nasdaq100',  'NASDAQ 100 as proxy'),
  ('Small cap',     'nasdaq100',  'NASDAQ 100 as proxy'),
  ('Mutual fund',   'sp500',      'S&P 500 as proxy'),
  ('ETF',           'nasdaq100',  'NASDAQ 100 as proxy'),
  ('Treasury bond', NULL,         'Fixed income — no stock scan')
ON CONFLICT (investment_type) DO NOTHING;
