import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeTicker } from "@/lib/agents";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const universe  = body.universe  ?? "mega10";
  const profileId = body.profile_id ?? null;
  const isManual  = universe === "manual";

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let symbols: string[] = [];

  if (isManual && profileId) {
    // Manual picks: load from profile_tickers
    const { data, error } = await sb
      .from("profile_tickers")
      .select("symbol")
      .eq("profile_id", profileId)
      .eq("user_id", user.id);

    if (error || !data?.length) {
      return NextResponse.json({ error: "No stocks in this profile yet. Add stocks via Edit Profile." }, { status: 400 });
    }
    symbols = data.map((r) => r.symbol);
  } else {
    // Preset universe: load from market_universe
    const { data, error } = await sb
      .from("market_universe")
      .select("symbol")
      .eq("universe", universe)
      .order("sort_order");

    if (error || !data?.length) {
      return NextResponse.json({ error: "No tickers found for universe" }, { status: 400 });
    }
    symbols = data.map((r) => r.symbol);
  }

  // For manual profiles, use a unique universe key so results don't clash with other profiles
  const scanUniverse = isManual && profileId ? `manual_${profileId}` : universe;

  const NEUTRAL_HURDLE = 0;
  const DEFAULT_PERIOD = "3yr";

  const results = [];
  for (const symbol of symbols) {
    const result = await analyzeTicker(symbol, NEUTRAL_HURDLE, DEFAULT_PERIOD);
    results.push(result);

    await sb.from("market_scans").insert({
      symbol,
      universe: scanUniverse,
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

  return NextResponse.json({ universe: scanUniverse, scanned: results.length, scanned_at: new Date().toISOString() });
}
