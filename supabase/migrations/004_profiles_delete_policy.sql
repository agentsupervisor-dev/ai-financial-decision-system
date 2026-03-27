-- AI Financial Decision System
-- Migration 004: Add DELETE policy for profiles table
--
-- Run this in your Supabase project:
--   Dashboard > SQL Editor > New query > Paste & Run

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);
