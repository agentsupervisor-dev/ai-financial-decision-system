import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const sb = getSupabase(token);
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await sb
    .from("profile_workspaces")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ workspace: data ?? null });
}

export async function PUT(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const sb = getSupabase(token);
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, currency, aum, portfolioCount, portfolios, strategies } = await req.json();

  const { error: upsertError } = await sb
    .from("profile_workspaces")
    .upsert(
      { user_id: user.id, name, currency, aum, portfolio_count: portfolioCount, portfolios, strategies, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
