-- AI Financial Decision System
-- Migration 002: Create profiles table
--
-- Run this in your Supabase project:
--   Dashboard > SQL Editor > New query > Paste & Run

CREATE TABLE IF NOT EXISTS profiles (
  id                BIGSERIAL    PRIMARY KEY,
  user_id           UUID         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_period TEXT         NOT NULL DEFAULT '3yr'
                      CHECK (investment_period IN ('1yr', '3yr', '5yr')),
  inflation         FLOAT        NOT NULL DEFAULT 3.5,
  borrowing         FLOAT        NOT NULL DEFAULT 7.5,
  index_return      FLOAT        NOT NULL DEFAULT 12.0,
  opex              FLOAT        NOT NULL DEFAULT 0.5,
  alpha_target      FLOAT        NOT NULL DEFAULT 6.5,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Only the owning user can read/write their profile (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);
