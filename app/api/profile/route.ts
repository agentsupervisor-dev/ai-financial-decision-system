import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// GET — return all profiles for the authenticated user
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = serverSupabase(token);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data ?? [] });
}

// POST — create a new profile
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = serverSupabase(token);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, investment_period, inflation, borrowing, index_return, opex, alpha_target, universe_type, universe_key, manual_tickers } = body;

  const profileName = (name || "My Portfolio").trim();

  // Check for duplicate name before inserting
  const { data: existing, error: dupeError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", profileName)
    .maybeSingle();

  if (!dupeError && existing) {
    return NextResponse.json({ error: "A profile with that name already exists." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      name: profileName,
      investment_period,
      inflation,
      borrowing,
      index_return,
      opex,
      alpha_target,
      universe_type: universe_type ?? "preset",
      universe_key: universe_key ?? "mega10",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Save manual tickers if provided
  if (universe_type === "manual" && Array.isArray(manual_tickers) && manual_tickers.length > 0 && data) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await sb.from("profile_tickers").insert(
      manual_tickers.map((symbol: string) => ({ profile_id: data.id, user_id: user.id, symbol }))
    );
  }

  return NextResponse.json({ profile: data });
}
