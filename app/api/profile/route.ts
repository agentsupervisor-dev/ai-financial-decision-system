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
  const { name, investment_period, inflation, borrowing, index_return, opex, alpha_target } = body;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      name: name || "My Portfolio",
      investment_period,
      inflation,
      borrowing,
      index_return,
      opex,
      alpha_target,
    })
    .select()
    .single();

  if (error) {
    const isDuplicate = error.message?.includes("profiles_user_id_name_unique") || error.code === "23505";
    return NextResponse.json(
      { error: isDuplicate ? "A profile with that name already exists." : error.message },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ profile: data });
}
