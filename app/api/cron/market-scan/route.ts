import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeTicker } from "@/lib/agents";

function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const universe = req.nextUrl.searchParams.get("universe") ?? "mega10";
  const sb = serviceSupabase();

  // Load tickers for this universe
  const { data: tickers, error: tickerError } = await sb
    .from("market_universe")
    .select("symbol")
    .eq("universe", universe)
    .order("sort_order");

  if (tickerError || !tickers?.length) {
    return NextResponse.json({ error: "No tickers found for universe" }, { status: 400 });
  }

  // Use a neutral hurdle rate (0%) — scores only, decision computed per-user client-side
  const NEUTRAL_HURDLE = 0;
  const DEFAULT_PERIOD = "3yr";

  const results = [];
  for (const { symbol } of tickers) {
    const result = await analyzeTicker(symbol, NEUTRAL_HURDLE, DEFAULT_PERIOD);
    results.push(result);

    // Insert into market_scans
    await sb.from("market_scans").insert({
      symbol,
      universe,
      forensic_score:  result.forensic_score,
      macro_score:     result.macro_score,
      asymmetry_score: result.asymmetry_score,
      composite_score: result.composite_score,
      confidence:      result.confidence,
      expected_return: result.expected_return,
      decision_summary: result.decision_summary,
      error:           result.error ?? null,
    });
  }

  return NextResponse.json({
    universe,
    scanned: results.length,
    symbols: results.map((r) => r.ticker),
    scanned_at: new Date().toISOString(),
  });
}
