import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toUpperCase() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Search across all seeded universes (deduplicate by symbol)
  const { data } = await sb
    .from("market_universe")
    .select("symbol, company_name, sector, exchange")
    .or(`symbol.ilike.${q}%,company_name.ilike.%${q}%`)
    .order("symbol")
    .limit(20);

  // Deduplicate by symbol
  const seen = new Set<string>();
  const results = (data ?? []).filter((r) => {
    if (seen.has(r.symbol)) return false;
    seen.add(r.symbol);
    return true;
  });

  // If exact symbol typed but not in DB, still allow it (validate via FMP)
  if (results.length === 0 && /^[A-Z]{1,5}$/.test(q)) {
    const apiKey = process.env.FMP_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://financialmodelingprep.com/stable/search-symbol?query=${q}&apikey=${apiKey}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const fmpData = await res.json() as { symbol: string; name: string; exchangeShortName: string }[];
          const usOnly = fmpData.filter((r) => ["NYSE", "NASDAQ", "AMEX"].includes(r.exchangeShortName)).slice(0, 10);
          return NextResponse.json({
            results: usOnly.map((r) => ({ symbol: r.symbol, company_name: r.name, sector: null, exchange: r.exchangeShortName })),
          });
        }
      } catch { /* return empty */ }
    }
  }

  return NextResponse.json({ results });
}
