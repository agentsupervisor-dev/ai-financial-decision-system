import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function authSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

function serviceSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — return all VIP portfolios + positions for the user
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = authSupabase(token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = serviceSupabase();

  // Load all portfolios for this user
  const { data: portfolios } = await sb
    .from("vip_portfolios")
    .select("*, profiles(name, investment_period, inflation, borrowing, index_return, opex, alpha_target, universe_key)")
    .eq("user_id", user.id)
    .order("created_at");

  if (!portfolios?.length) return NextResponse.json({ portfolios: [] });

  // Load all active positions
  const portfolioIds = portfolios.map((p) => p.id);
  const { data: positions } = await sb
    .from("vip_positions")
    .select("*")
    .in("portfolio_id", portfolioIds)
    .neq("status", "sold")
    .order("bought_at", { ascending: false });

  // Load recent transactions
  const { data: transactions } = await sb
    .from("vip_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ portfolios: portfolios ?? [], positions: positions ?? [], transactions: transactions ?? [] });
}

// POST — initialise a VIP portfolio for a profile (called automatically on first buy)
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = authSupabase(token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile_id } = await req.json();
  const sb = serviceSupabase();

  const { data, error: insertError } = await sb
    .from("vip_portfolios")
    .upsert({ profile_id, user_id: user.id, initial_balance: 10000, current_balance: 10000 }, { onConflict: "profile_id" })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ portfolio: data });
}
