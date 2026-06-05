CREATE TABLE IF NOT EXISTS profile_workspaces (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name           text NOT NULL DEFAULT 'My Workspace',
  currency       text NOT NULL DEFAULT 'USD',
  aum            numeric NOT NULL DEFAULT 10000000,
  portfolio_count integer NOT NULL DEFAULT 1,
  portfolios     jsonb NOT NULL DEFAULT '[]',
  strategies     jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE profile_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_owner" ON profile_workspaces;
CREATE POLICY "workspace_owner" ON profile_workspaces
  FOR ALL USING (auth.uid() = user_id);
