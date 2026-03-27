-- Agent prompt customization table
-- Stores one editable instruction block per agent, managed by superusers via the admin UI.
CREATE TABLE IF NOT EXISTS agent_prompts (
  agent       TEXT PRIMARY KEY,  -- 'forensic' | 'macro' | 'asymmetry' | 'decision'
  instructions TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT
);

-- Only service role can read/write (accessed server-side only; no RLS user access needed)
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS policies — all access goes through the service role key in API routes
