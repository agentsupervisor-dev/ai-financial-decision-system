import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function assertSuperuser(req: NextRequest) {
  // Verify the caller's JWT and check their email against the superuser list
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return null;
  if (!SUPERUSER_EMAILS.length || !SUPERUSER_EMAILS.includes((user.email ?? "").toLowerCase())) return null;
  return user;
}

// GET — return all agent prompts
export async function GET(req: NextRequest) {
  const user = await assertSuperuser(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = serviceSupabase();
  const { data, error } = await sb.from("agent_prompts").select("agent, instructions, updated_at, updated_by");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prompts: data ?? [] });
}

// PUT — upsert instructions for one agent
export async function PUT(req: NextRequest) {
  const user = await assertSuperuser(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { agent, instructions } = await req.json();
  const VALID_AGENTS = ["forensic", "macro", "asymmetry", "decision"];
  if (!VALID_AGENTS.includes(agent)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }

  const sb = serviceSupabase();
  const { error } = await sb.from("agent_prompts").upsert(
    { agent, instructions, updated_at: new Date().toISOString(), updated_by: user.email },
    { onConflict: "agent" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
