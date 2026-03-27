"""
Fetches custom agent instructions from Supabase.
Falls back to None if not set — callers use their hardcoded defaults in that case.
"""
import os
from supabase import create_client

_sb = None

def _client():
    global _sb
    if _sb is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            _sb = create_client(url, key)
    return _sb


def get_instructions(agent: str) -> str | None:
    """Return custom instructions for the given agent, or None if not set."""
    try:
        sb = _client()
        if not sb:
            return None
        res = sb.table("agent_prompts").select("instructions").eq("agent", agent).maybeSingle().execute()
        if res.data and res.data.get("instructions"):
            return res.data["instructions"]
    except Exception as e:
        print(f"[prompt_store] Could not fetch prompt for {agent}: {e}")
    return None
