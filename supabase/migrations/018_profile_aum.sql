-- Add AUM, allocation and divestment fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aum_amount     FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aum_currency   TEXT    DEFAULT 'USD';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aum_usd        FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allocation_pct FLOAT   DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS divestment     TEXT    DEFAULT 'never';
-- Groups profiles created together in one wizard session
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aum_group_id   UUID;
