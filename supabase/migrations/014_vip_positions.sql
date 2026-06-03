-- VIP stock positions — one row per holding
CREATE TABLE IF NOT EXISTS vip_positions (
  id                 BIGSERIAL PRIMARY KEY,
  portfolio_id       BIGINT NOT NULL REFERENCES vip_portfolios(id) ON DELETE CASCADE,
  profile_id         INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  symbol             TEXT NOT NULL,
  company_name       TEXT NOT NULL,
  sector             TEXT,

  quantity           FLOAT NOT NULL,           -- number of shares
  buy_price          FLOAT NOT NULL,           -- price per share at buy time
  buy_amount         FLOAT NOT NULL,           -- total cost (quantity × buy_price)

  hurdle_rate        FLOAT NOT NULL,           -- profile hurdle rate at buy time (%)
  expected_return    FLOAT,                    -- AI expected return (%) at buy time
  target_price       FLOAT NOT NULL,           -- buy_price × (1 + hurdle_rate/100)

  current_price      FLOAT,                    -- latest known price
  current_value      FLOAT,                    -- quantity × current_price
  price_updated_at   TIMESTAMPTZ,

  status             TEXT NOT NULL DEFAULT 'holding',  -- holding | target_hit | sold

  bought_at          TIMESTAMPTZ DEFAULT NOW(),
  sold_at            TIMESTAMPTZ,
  sold_price         FLOAT,
  sold_amount        FLOAT,                    -- quantity × sold_price
  realised_pnl       FLOAT                    -- sold_amount - buy_amount
);

CREATE INDEX IF NOT EXISTS idx_vip_positions_profile ON vip_positions (profile_id, status);

ALTER TABLE vip_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vip_positions"
  ON vip_positions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
