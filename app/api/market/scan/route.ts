import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeTicker } from "@/lib/agents";

export async function POST(req: NextRequest) {
  // Require a valid user session
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { universe = "mega10" } = await req.json().catch(() => ({}));

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Load tickers for this universe
  const { data: tickers, error: tickerError } = await sb
    .from("market_universe")
    .select("symbol")
    .eq("universe", universe)
    .order("sort_order");

  if (tickerError || !tickers?.length) {
    return NextResponse.json({ error: "No tickers found for universe" }, { status: 400 });
  }

  const NEUTRAL_HURDLE = 0;
  const DEFAULT_PERIOD = "3yr";

  const results = [];
  for (const { symbol } of tickers) {
    const result = await analyzeTicker(symbol, NEUTRAL_HURDLE, DEFAULT_PERIOD);
    results.push(result);

    await sb.from("market_scans").insert({
      symbol,
      universe,
      forensic_score:   result.forensic_score,
      macro_score:      result.macro_score,
      asymmetry_score:  result.asymmetry_score,
      composite_score:  result.composite_score,
      confidence:       result.confidence,
      expected_return:  result.expected_return,
      decision_summary: result.decision_summary,
      error:            result.error ?? null,
    });
  }

  return NextResponse.json({
    universe,
    scanned: results.length,
    scanned_at: new Date().toISOString(),
  });
}
