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

  const { profile_id, symbol, company_name, sector, quantity, buy_price, hurdle_rate, expected_return } = await req.json();

  if (!profile_id || !symbol || !quantity || !buy_price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const buy_amount = parseFloat((quantity * buy_price).toFixed(2));
  const target_price = parseFloat((buy_price * (1 + hurdle_rate / 100)).toFixed(2));

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Ensure portfolio exists, create if not
  const { data: portfolio, error: portError } = await sb
    .from("vip_portfolios")
    .upsert({ profile_id, user_id: user.id, initial_balance: 10000, current_balance: 10000 }, { onConflict: "profile_id" })
    .select()
    .single();

  if (portError || !portfolio) return NextResponse.json({ error: "Portfolio error" }, { status: 500 });

  if (portfolio.current_balance < buy_amount) {
    return NextResponse.json({ error: `Insufficient balance. Available: $${portfolio.current_balance.toFixed(2)}` }, { status: 400 });
  }

  const new_balance = parseFloat((portfolio.current_balance - buy_amount).toFixed(2));

  // Create position
  const { data: position, error: posError } = await sb.from("vip_positions").insert({
    portfolio_id: portfolio.id, profile_id, user_id: user.id,
    symbol, company_name, sector: sector ?? null,
    quantity, buy_price, buy_amount, hurdle_rate,
    expected_return: expected_return ?? null,
    target_price,
    current_price: buy_price, current_value: buy_amount,
    price_updated_at: new Date().toISOString(),
    status: "holding",
  }).select().single();

  if (posError) return NextResponse.json({ error: posError.message }, { status: 500 });

  // Deduct from balance
  await sb.from("vip_portfolios").update({ current_balance: new_balance }).eq("id", portfolio.id);

  // Record transaction
  await sb.from("vip_transactions").insert({
    portfolio_id: portfolio.id, profile_id, user_id: user.id,
    position_id: position.id,
    type: "buy", symbol, company_name,
    quantity, price: buy_price, amount: buy_amount,
    balance_before: portfolio.current_balance,
    balance_after: new_balance,
  });

  return NextResponse.json({ position, new_balance });
}
