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

  const { profile_id } = await req.json().catch(() => ({}));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Load active positions to refresh
  let query = sb.from("vip_positions").select("id, symbol, quantity, buy_amount, target_price, status").eq("user_id", user.id).neq("status", "sold");
  if (profile_id) query = query.eq("profile_id", profile_id);
  const { data: positions } = await query;
  if (!positions?.length) return NextResponse.json({ updated: 0 });

  const apiKey = process.env.FMP_API_KEY;
  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const updated: string[] = [];

  await Promise.allSettled(symbols.map(async (symbol) => {
    try {
      const res = await fetch(`https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${apiKey}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { symbol: string; price: number }[];
      const price = data?.[0]?.price;
      if (!price) return;

      // Update all positions for this symbol
      const matching = positions.filter((p) => p.symbol === symbol);
      for (const pos of matching) {
        const current_value = parseFloat((pos.quantity * price).toFixed(2));
        const newStatus = price >= pos.target_price && pos.status === "holding" ? "target_hit" : pos.status;
        await sb.from("vip_positions").update({
          current_price: price, current_value,
          price_updated_at: new Date().toISOString(),
          status: newStatus,
        }).eq("id", pos.id);
      }
      updated.push(symbol);
    } catch { /* skip */ }
  }));

  return NextResponse.json({ updated: updated.length, symbols: updated });
}
