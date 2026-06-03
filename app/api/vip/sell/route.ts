import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { position_id } = await req.json();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: position } = await sb.from("vip_positions").select("*, vip_portfolios(current_balance)").eq("id", position_id).eq("user_id", user.id).single();
  if (!position) return NextResponse.json({ error: "Position not found" }, { status: 404 });

  const sell_price  = position.current_price ?? position.buy_price;
  const sold_amount = parseFloat((position.quantity * sell_price).toFixed(2));
  const realised_pnl = parseFloat((sold_amount - position.buy_amount).toFixed(2));
  const portfolio_balance = (position.vip_portfolios as { current_balance: number }).current_balance;
  const new_balance = parseFloat((portfolio_balance + sold_amount).toFixed(2));

  // Update position to sold
  await sb.from("vip_positions").update({
    status: "sold", sold_at: new Date().toISOString(),
    sold_price: sell_price, sold_amount, realised_pnl,
  }).eq("id", position_id);

  // Return cash to portfolio
  await sb.from("vip_portfolios").update({ current_balance: new_balance }).eq("id", position.portfolio_id);

  // Record transaction
  await sb.from("vip_transactions").insert({
    portfolio_id: position.portfolio_id, profile_id: position.profile_id,
    user_id: user.id, position_id,
    type: "sell", symbol: position.symbol, company_name: position.company_name,
    quantity: position.quantity, price: sell_price, amount: sold_amount,
    balance_before: portfolio_balance, balance_after: new_balance,
  });

  return NextResponse.json({ sold_amount, realised_pnl, new_balance });
}
