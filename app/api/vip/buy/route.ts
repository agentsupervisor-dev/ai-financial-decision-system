import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
  if (!symbol || !quantity || !buy_price) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const buy_amount    = parseFloat((quantity * buy_price).toFixed(2));
  const target_price  = parseFloat((buy_price * (1 + hurdle_rate / 100)).toFixed(2));

  // Get or create user wallet (one per user)
  const { data: wallet, error: walletErr } = await sb()
    .from("vip_portfolios")
    .upsert({ user_id: user.id, initial_balance: 10000, current_balance: 10000 }, { onConflict: "user_id" })
    .select().single();

  if (walletErr || !wallet) return NextResponse.json({ error: "Wallet error" }, { status: 500 });
  if (wallet.current_balance < buy_amount) {
    return NextResponse.json({ error: `Insufficient balance. Available: $${wallet.current_balance.toFixed(2)}` }, { status: 400 });
  }

  const new_balance = parseFloat((wallet.current_balance - buy_amount).toFixed(2));

  const { data: position, error: posErr } = await sb().from("vip_positions").insert({
    portfolio_id: wallet.id,
    profile_id:   profile_id ?? null,
    user_id:      user.id,
    symbol, company_name, sector: sector ?? null,
    quantity, buy_price, buy_amount, hurdle_rate,
    expected_return: expected_return ?? null,
    target_price,
    current_price: buy_price, current_value: buy_amount,
    price_updated_at: new Date().toISOString(),
    status: "holding",
  }).select().single();

  if (posErr) return NextResponse.json({ error: posErr.message }, { status: 500 });

  await sb().from("vip_portfolios").update({ current_balance: new_balance }).eq("id", wallet.id);

  await sb().from("vip_transactions").insert({
    portfolio_id: wallet.id,
    profile_id:   profile_id ?? null,
    user_id:      user.id,
    position_id:  position.id,
    type: "buy", symbol, company_name,
    quantity, price: buy_price, amount: buy_amount,
    balance_before: wallet.current_balance,
    balance_after:  new_balance,
  });

  return NextResponse.json({ position, new_balance });
}
