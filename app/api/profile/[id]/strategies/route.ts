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

// GET — load all strategies + investments for a profile
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: strategies } = await sb()
    .from("portfolio_strategies")
    .select("*, strategy_investments(*)")
    .eq("profile_id", id)
    .eq("user_id", user.id)
    .order("sort_order");

  return NextResponse.json({ strategies: strategies ?? [] });
}

// POST — replace all strategies for a profile (full upsert)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { strategies } = await req.json() as {
    strategies: {
      objective: string; holding_period: string; aum_pct: number;
      hurdle_rate: number; stop_loss: number; sort_order: number; is_remainder: boolean;
      investments: { investment_type: string; allocation_pct: number; sort_order: number }[];
    }[]
  };

  // Delete existing strategies (cascade deletes investments)
  await sb().from("portfolio_strategies").delete().eq("profile_id", id).eq("user_id", user.id);

  // Insert new strategies
  for (const s of strategies) {
    const { data: strat, error: stratErr } = await sb().from("portfolio_strategies").insert({
      profile_id:    Number(id),
      user_id:       user.id,
      objective:     s.objective,
      holding_period: s.holding_period,
      aum_pct:       s.aum_pct,
      hurdle_rate:   s.hurdle_rate,
      stop_loss:     s.stop_loss,
      sort_order:    s.sort_order,
      is_remainder:  s.is_remainder,
    }).select().single();

    if (stratErr || !strat) continue;

    // Insert investments for this strategy
    const invRows = s.investments.filter((inv) => inv.investment_type && inv.allocation_pct > 0);
    if (invRows.length > 0) {
      await sb().from("strategy_investments").insert(
        invRows.map((inv, i) => ({
          strategy_id:     strat.id,
          investment_type: inv.investment_type,
          allocation_pct:  inv.allocation_pct,
          sort_order:      i,
        }))
      );
    }
  }

  return NextResponse.json({ success: true });
}
