import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TICKERS } from "@/data/tickers";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  // Authenticate user
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found. Please set up your profile first." }, { status: 400 });
  }

  const hurdle_rate = profile.inflation + profile.borrowing + profile.index_return + profile.opex + profile.alpha_target;

  // Analyze all tickers sequentially
  const results = [];
  for (const ticker of TICKERS) {
    try {
      const params = new URLSearchParams({
        inflation: String(profile.inflation),
        borrowing: String(profile.borrowing),
        index_return: String(profile.index_return),
        opex: String(profile.opex),
        alpha_target: String(profile.alpha_target),
        investment_period: profile.investment_period,
      });

      const res = await fetch(
        `${ORCHESTRATOR_URL}/analyze/${encodeURIComponent(ticker)}?${params}`,
        { cache: "no-store" }
      );

      if (res.ok) {
        const data = await res.json();
        results.push(data);
      } else {
        results.push({ ticker, error: `Analysis failed (${res.status})`, hurdle_rate });
      }
    } catch {
      results.push({ ticker, error: "Could not reach orchestrator", hurdle_rate });
    }
  }

  // Filter to stocks that clear the hurdle, sorted by composite score descending
  const passing = results
    .filter((r) => r.clears_hurdle === true)
    .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0));

  return NextResponse.json({
    profile: {
      investment_period: profile.investment_period,
      hurdle_rate,
    },
    total_scanned: results.length,
    total_passing: passing.length,
    results: passing,
  });
}
