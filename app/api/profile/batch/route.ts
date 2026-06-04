import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function authClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { portfolios, universe_type, universe_key, hurdle_components } = await req.json();
  // portfolios: [{ name, allocation_pct, divestment, aum_amount, aum_currency, aum_usd }]

  if (!Array.isArray(portfolios) || portfolios.length === 0) {
    return NextResponse.json({ error: "No portfolios provided" }, { status: 400 });
  }

  const aum_group_id = randomUUID();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const created = [];
  for (const p of portfolios) {
    const { data, error: insertErr } = await sb.from("profiles").insert({
      user_id:         user.id,
      name:            p.name,
      investment_period: p.investment_period ?? "3yr",
      inflation:       hurdle_components?.inflation       ?? 3.5,
      borrowing:       hurdle_components?.borrowing       ?? 7.5,
      index_return:    hurdle_components?.index_return    ?? 12.0,
      opex:            hurdle_components?.opex            ?? 0.5,
      alpha_target:    hurdle_components?.alpha_target    ?? 6.5,
      universe_type:   universe_type ?? "preset",
      universe_key:    universe_key  ?? "mega10",
      aum_amount:      p.aum_amount,
      aum_currency:    p.aum_currency,
      aum_usd:         p.aum_usd,
      allocation_pct:  p.allocation_pct,
      divestment:      p.divestment ?? "never",
      aum_group_id,
    }).select().single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    created.push(data);
  }

  return NextResponse.json({ profiles: created, aum_group_id });
}
