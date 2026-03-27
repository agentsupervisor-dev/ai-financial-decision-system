-- AI Financial Decision System
-- Migration 005: Enforce unique profile name per user
--
-- Run this in your Supabase project:
--   Dashboard > SQL Editor > New query > Paste & Run

ALTER TABLE profiles
  ADD CONSTRAINT profiles_user_id_name_unique UNIQUE (user_id, name);
