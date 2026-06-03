-- VIP transaction ledger — full audit trail of every buy/sell
CREATE TABLE IF NOT EXISTS vip_transactions (
  id               BIGSERIAL PRIMARY KEY,
  portfolio_id     BIGINT NOT NULL REFERENCES vip_portfolios(id) ON DELETE CASCADE,
  profile_id       INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id      BIGINT REFERENCES vip_positions(id),

  type             TEXT NOT NULL,   -- 'buy' | 'sell'
  symbol           TEXT NOT NULL,
  company_name     TEXT NOT NULL,
  quantity         FLOAT NOT NULL,
  price            FLOAT NOT NULL,
  amount           FLOAT NOT NULL,  -- quantity × price (positive = cash out, negative = cash in)
  balance_before   FLOAT NOT NULL,
  balance_after    FLOAT NOT NULL,

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_transactions_profile ON vip_transactions (profile_id, created_at DESC);

ALTER TABLE vip_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vip_transactions"
  ON vip_transactions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
