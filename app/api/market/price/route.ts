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

  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No FMP key" }, { status: 500 });

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ error: "FMP error" }, { status: 502 });
    const data = await res.json() as { symbol: string; price: number; changePercentage: number }[];
    const q = data?.[0];
    if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ symbol: q.symbol, price: q.price, change_pct: q.changePercentage });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
