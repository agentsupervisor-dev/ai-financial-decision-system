-- Change VIP portfolio from per-profile to per-user (one shared wallet)
-- Drop the per-profile unique constraint
ALTER TABLE vip_portfolios DROP CONSTRAINT IF EXISTS vip_portfolios_profile_id_key;

-- Make profile_id nullable (wallet is now user-level, not profile-level)
ALTER TABLE vip_portfolios ALTER COLUMN profile_id DROP NOT NULL;

-- Add per-user unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vip_portfolios_user_id_unique'
  ) THEN
    ALTER TABLE vip_portfolios ADD CONSTRAINT vip_portfolios_user_id_unique UNIQUE(user_id);
  END IF;
END $$;
