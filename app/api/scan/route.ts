import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TICKERS as DEFAULT_TICKERS } from "@/data/tickers";

async function getActiveTickers(): Promise<string[]> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data } = await sb.from("admin_tickers").select("symbol").order("added_at");
    if (data && data.length > 0) return data.map((r) => r.symbol);
  } catch { /* fall through to defaults */ }
  return DEFAULT_TICKERS;
}

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8000";

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

  // Load specific profile by id
  const profileId = new URL(req.url).searchParams.get("profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 400 });
  }

  const hurdle_rate = profile.inflation + profile.borrowing + profile.index_return + profile.opex + profile.alpha_target;

  // Analyze all tickers sequentially (from Supabase if set, else hardcoded defaults)
  const tickers = await getActiveTickers();
  const results = [];
  for (const ticker of tickers) {
    try {
      const params = new URLSearchParams({
        inflation: String(profile.inflation),
        borrowing: String(profile.borrowing),
        index_return: String(profile.index_return),
        opex: String(profile.opex),
        alpha_target: String(profile.alpha_target),
        investment_period: profile.investment_period,
        profile_id: String(profile.id),
      });

      const res = await fetch(
        `${ORCHESTRATOR_URL}/analyze/${encodeURIComponent(ticker)}?${params}`,
        { cache: "no-store" }
      );

      if (res.ok) {
        results.push(await res.json());
      } else {
        results.push({ ticker, error: `Analysis failed (${res.status})`, hurdle_rate });
      }
    } catch {
      results.push({ ticker, error: "Could not reach orchestrator", hurdle_rate });
    }
  }

  const sorted = results.sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0));
  const total_passing = results.filter((r) => r.clears_hurdle === true).length;

  return NextResponse.json({
    profile: { name: profile.name, investment_period: profile.investment_period, hurdle_rate },
    total_scanned: results.length,
    total_passing,
    results: sorted,
  });
}
