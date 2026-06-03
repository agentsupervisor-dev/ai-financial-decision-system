-- Add universe configuration to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS universe_type TEXT NOT NULL DEFAULT 'preset',
  ADD COLUMN IF NOT EXISTS universe_key  TEXT NOT NULL DEFAULT 'mega10';

-- Per-profile tickers for manual picks
CREATE TABLE IF NOT EXISTS profile_tickers (
  id         BIGSERIAL PRIMARY KEY,
  profile_id INT  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol     TEXT NOT NULL,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, symbol)
);

ALTER TABLE profile_tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile tickers"
  ON profile_tickers
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
