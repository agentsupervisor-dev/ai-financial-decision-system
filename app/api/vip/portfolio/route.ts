import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function authClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — user's wallet + all positions across all profiles
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: wallet } = await sb()
    .from("vip_portfolios")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: positions } = wallet
    ? await sb().from("vip_positions").select("*").eq("user_id", user.id).neq("status", "sold").order("bought_at", { ascending: false })
    : { data: [] };

  const { data: transactions } = await sb()
    .from("vip_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ wallet: wallet ?? null, positions: positions ?? [], transactions: transactions ?? [] });
}

// POST — initialise wallet for user (idempotent)
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: upsertErr } = await sb()
    .from("vip_portfolios")
    .upsert({ user_id: user.id, initial_balance: 10000, current_balance: 10000 }, { onConflict: "user_id" })
    .select().single();

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  return NextResponse.json({ wallet: data });
}
