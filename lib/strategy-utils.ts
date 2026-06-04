import { createClient } from "@supabase/supabase-js";

// Investment type → stock universe key mapping
export const INVESTMENT_TYPE_UNIVERSE: Record<string, string | null> = {
  "Jumbo cap":     "mega10",
  "Mega cap":      "mega10",
  "Large cap":     "sp500",
  "Mid cap":       "nasdaq100",
  "Small cap":     "nasdaq100",
  "Mutual fund":   "sp500",
  "ETF":           "nasdaq100",
  "Treasury bond": null,  // fixed income — no stock scan
};

// Get the effective hurdle rate for a profile:
// If strategies exist → weighted average hurdle across active strategies
// Otherwise → fall back to profile-level hurdle (inflation + borrowing + ...)
export async function getEffectiveHurdleRate(profileId: number, fallbackHurdle: number): Promise<number> {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: strategies } = await sb
      .from("portfolio_strategies")
      .select("hurdle_rate, aum_pct")
      .eq("profile_id", profileId);

    if (!strategies?.length) return fallbackHurdle;

    const total = strategies.reduce((s, r) => s + r.aum_pct, 0);
    if (total === 0) return fallbackHurdle;

    const weighted = strategies.reduce((s, r) => s + r.hurdle_rate * (r.aum_pct / total), 0);
    return parseFloat(weighted.toFixed(2));
  } catch {
    return fallbackHurdle;
  }
}

// Get the primary universe for a profile based on investment type allocations
export async function getPrimaryUniverseForProfile(profileId: number, fallbackUniverse: string): Promise<string> {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Load strategies with their investments
    const { data: strategies } = await sb
      .from("portfolio_strategies")
      .select("aum_pct, strategy_investments(investment_type, allocation_pct)")
      .eq("profile_id", profileId);

    if (!strategies?.length) return fallbackUniverse;

    // Weight each investment type by (strategy aum_pct × investment allocation_pct)
    const universeWeight: Record<string, number> = {};
    for (const strat of strategies) {
      const invs = (strat.strategy_investments as { investment_type: string; allocation_pct: number }[]) ?? [];
      for (const inv of invs) {
        const universe = INVESTMENT_TYPE_UNIVERSE[inv.investment_type];
        if (!universe) continue;
        const weight = (strat.aum_pct / 100) * (inv.allocation_pct / 100);
        universeWeight[universe] = (universeWeight[universe] ?? 0) + weight;
      }
    }

    if (Object.keys(universeWeight).length === 0) return fallbackUniverse;

    // Return the universe with the highest weight
    return Object.entries(universeWeight).sort((a, b) => b[1] - a[1])[0][0];
  } catch {
    return fallbackUniverse;
  }
}
