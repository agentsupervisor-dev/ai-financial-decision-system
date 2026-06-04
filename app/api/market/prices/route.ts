import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  ).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { symbols } = await req.json() as { symbols: string[] };
  if (!Array.isArray(symbols) || symbols.length === 0) return NextResponse.json({ prices: {} });

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return NextResponse.json({ prices: {} });

  const prices: Record<string, { price: number; change_pct: number }> = {};

  for (const symbol of symbols.slice(0, 30)) {
    try {
      const res = await fetch(
        `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${apiKey}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json() as { symbol: string; price: number; changePercentage: number }[];
        const q = data?.[0];
        if (q?.price) prices[q.symbol] = { price: q.price, change_pct: q.changePercentage ?? 0 };
      }
    } catch { /* skip */ }
    await new Promise((r) => setTimeout(r, 120));
  }

  return NextResponse.json({ prices });
}
