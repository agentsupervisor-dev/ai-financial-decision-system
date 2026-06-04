-- Investment strategies per portfolio profile
CREATE TABLE IF NOT EXISTS portfolio_strategies (
  id             BIGSERIAL PRIMARY KEY,
  profile_id     INT  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  objective      TEXT  NOT NULL DEFAULT 'realized',  -- 'unrealized' | 'realized'
  holding_period TEXT  NOT NULL DEFAULT '3 years',
  aum_pct        FLOAT NOT NULL DEFAULT 0,           -- % of portfolio AUM
  hurdle_rate    FLOAT NOT NULL DEFAULT 7.0,
  stop_loss      FLOAT NOT NULL DEFAULT 12.0,
  sort_order     INT   NOT NULL DEFAULT 0,
  is_remainder   BOOLEAN NOT NULL DEFAULT FALSE,     -- last row auto-fills remainder

  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_strategies_profile ON portfolio_strategies (profile_id, sort_order);

ALTER TABLE portfolio_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own strategies"
  ON portfolio_strategies
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
