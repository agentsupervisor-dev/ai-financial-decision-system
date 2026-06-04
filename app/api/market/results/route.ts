import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEffectiveHurdleRate } from "@/lib/strategy-utils";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const universe  = req.nextUrl.searchParams.get("universe") ?? "mega10";
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const isManual  = universe === "manual";

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Load tickers — from profile_tickers for manual, market_universe for presets
  let tickers: { symbol: string; company_name: string; sector: string; exchange: string; sort_order: number }[] = [];

  if (isManual && profileId) {
    const { data } = await sb
      .from("profile_tickers")
      .select("symbol, added_at")
      .eq("profile_id", profileId)
      .eq("user_id", user.id)
      .order("added_at");

    // For manual tickers, fetch company info from market_universe or FMP
    const symbols = (data ?? []).map((r) => r.symbol);
    if (symbols.length > 0) {
      // Try to get metadata from market_universe first
      const { data: meta } = await sb
        .from("market_universe")
        .select("symbol, company_name, sector, exchange")
        .in("symbol", symbols);

      const metaMap = Object.fromEntries((meta ?? []).map((m) => [m.symbol, m]));

      tickers = symbols.map((sym, i) => ({
        symbol:       sym,
        company_name: metaMap[sym]?.company_name ?? sym,
        sector:       metaMap[sym]?.sector ?? "—",
        exchange:     metaMap[sym]?.exchange ?? "—",
        sort_order:   i,
      }));
    }
  } else {
    const { data } = await sb
      .from("market_universe")
      .select("symbol, company_name, sector, exchange, sort_order")
      .eq("universe", universe)
      .order("sort_order");
    tickers = data ?? [];
  }

  if (!tickers.length) return NextResponse.json({ universe, results: [], scanned_at: null });

  const symbols = tickers.map((t) => t.symbol);

  // Scan results key: for manual profiles use profile-specific universe key
  const scanUniverse = isManual && profileId ? `manual_${profileId}` : universe;

  const { data: scans } = await sb
    .from("market_scans")
    .select("symbol, forensic_score, macro_score, asymmetry_score, composite_score, confidence, expected_return, decision_summary, error, scanned_at, price, change_pct")
    .eq("universe", scanUniverse)
    .in("symbol", symbols)
    .order("scanned_at", { ascending: false });

  const latestBySymbol: Record<string, (typeof scans extends (infer T)[] | null ? T : never)> = {};
  for (const scan of scans ?? []) {
    if (!latestBySymbol[scan.symbol]) latestBySymbol[scan.symbol] = scan;
  }

  // Use price stored at scan time — fast, no FMP rate limit risk
  // (Live price refresh happens via the Buy modal or ↻ Refresh button on Portfolio page)
  const results = tickers.map((t) => {
    const scan = latestBySymbol[t.symbol] ?? null;
    return {
      symbol: t.symbol, company_name: t.company_name, sector: t.sector, exchange: t.exchange,
      price:            scan?.price      ?? null,
      change_pct:       scan?.change_pct ?? null,
      forensic_score:   scan?.forensic_score ?? null,
      macro_score:      scan?.macro_score ?? null,
      asymmetry_score:  scan?.asymmetry_score ?? null,
      composite_score:  scan?.composite_score ?? null,
      confidence:       scan?.confidence ?? null,
      expected_return:  scan?.expected_return ?? null,
      decision_summary: scan?.decision_summary ?? null,
      error:            scan?.error ?? null,
      scanned_at:       scan?.scanned_at ?? null,
    };
  });

  // Compute effective hurdle from strategies if profile has them
  let effectiveHurdle: number | null = null;
  if (profileId) {
    const { data: profile } = await sb.from("profiles")
      .select("inflation, borrowing, index_return, opex, alpha_target")
      .eq("id", profileId).single();
    const fallback = profile
      ? profile.inflation + profile.borrowing + profile.index_return + profile.opex + profile.alpha_target
      : 0;
    effectiveHurdle = await getEffectiveHurdleRate(Number(profileId), fallback);
  }

  return NextResponse.json({
    universe, results,
    scanned_at: scans?.[0]?.scanned_at ?? null,
    effective_hurdle: effectiveHurdle,
  });
}
