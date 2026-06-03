import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
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

  const universe = req.nextUrl.searchParams.get("universe") ?? "mega10";
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Load universe tickers with metadata
  const { data: tickers } = await sb
    .from("market_universe")
    .select("symbol, company_name, sector, exchange, sort_order")
    .eq("universe", universe)
    .order("sort_order");

  if (!tickers?.length) {
    return NextResponse.json({ universe, results: [], scanned_at: null });
  }

  const symbols = tickers.map((t) => t.symbol);

  // Latest scan result per symbol using a subquery approach
  const { data: scans } = await sb
    .from("market_scans")
    .select("symbol, forensic_score, macro_score, asymmetry_score, composite_score, confidence, expected_return, decision_summary, error, scanned_at")
    .eq("universe", universe)
    .in("symbol", symbols)
    .order("scanned_at", { ascending: false });

  // Keep only the latest scan per symbol
  const latestBySymbol: Record<string, typeof scans extends (infer T)[] | null ? T : never> = {};
  for (const scan of scans ?? []) {
    if (!latestBySymbol[scan.symbol]) {
      latestBySymbol[scan.symbol] = scan;
    }
  }

  // Fetch live prices in parallel — one request per ticker
  const apiKey = process.env.FMP_API_KEY;
  let prices: Record<string, { price: number; changesPercentage: number }> = {};
  if (apiKey) {
    const priceResults = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const res = await fetch(
          `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${apiKey}`,
          { cache: "no-store" }
        );
        if (!res.ok) return null;
        const data = await res.json() as { symbol: string; price: number; changePercentage: number }[];
        return data?.[0] ?? null;
      })
    );
    for (const result of priceResults) {
      if (result.status === "fulfilled" && result.value) {
        const q = result.value;
        prices[q.symbol] = { price: q.price, changesPercentage: q.changePercentage };
      }
    }
  }

  const results = tickers.map((t) => {
    const scan = latestBySymbol[t.symbol] ?? null;
    const price = prices[t.symbol] ?? null;
    return {
      symbol:           t.symbol,
      company_name:     t.company_name,
      sector:           t.sector,
      exchange:         t.exchange,
      price:            price?.price ?? null,
      change_pct:       price?.changesPercentage ?? null,
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

  const latestScanAt = scans?.[0]?.scanned_at ?? null;

  return NextResponse.json({ universe, results, scanned_at: latestScanAt });
}
