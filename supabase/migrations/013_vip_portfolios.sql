-- Virtual Investment Portfolio — one per profile, starts with $10,000
CREATE TABLE IF NOT EXISTS vip_portfolios (
  id                BIGSERIAL PRIMARY KEY,
  profile_id        INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initial_balance   FLOAT NOT NULL DEFAULT 10000,
  current_balance   FLOAT NOT NULL DEFAULT 10000,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

ALTER TABLE vip_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vip_portfolios"
  ON vip_portfolios USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
