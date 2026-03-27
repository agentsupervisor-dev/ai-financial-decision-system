-- AI Financial Decision System
-- Migration 003: Allow multiple profiles per user
--
-- Run this in your Supabase project:
--   Dashboard > SQL Editor > New query > Paste & Run

-- Add profile name column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'My Portfolio';

-- Drop the unique constraint on user_id so one user can have many profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

-- Add index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);
