"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useScan, Profile } from "@/lib/ScanContext";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

const UNIVERSE_LABELS: Record<string, string> = {
  mega10:            "MEGA Cap Top 10",
  nasdaq100:         "NASDAQ 100 (Top 25)",
  sp500:             "S&P 500 (Top 30)",
  sector_tech:       "Technology",
  sector_health:     "Healthcare",
  sector_finance:    "Financial",
  sector_energy:     "Energy",
  sector_consumer:   "Consumer",
  sector_industrial: "Industrial",
  manual:            "Manual Picks",
};

interface MarketResult {
  symbol: string;
  company_name: string;
  sector: string;
  exchange: string;
  price: number | null;
  change_pct: number | null;
  forensic_score: number | null;
  macro_score: number | null;
  asymmetry_score: number | null;
  composite_score: number | null;
  confidence: number | null;
  expected_return: number | null;
  decision_summary: string | null;
  error: string | null;
  scanned_at: string | null;
}

function hurdleRate(p: Profile) {
  return p.inflation + p.borrowing + p.index_return + p.opex + p.alpha_target;
}

function computeDecision(
  composite: number | null,
  confidence: number | null,
  expectedReturn: number | null,
  hurdle: number,
  period: string,
): "BUY" | "HOLD" | "REJECT" | null {
  if (composite === null || confidence === null || expectedReturn === null) return null;
  const thresholds: Record<string, number> = { "1yr": 65, "3yr": 55, "5yr": 48 };
  const threshold = thresholds[period] ?? 55;
  if (composite >= threshold && confidence >= 50 && expectedReturn >= hurdle) return "BUY";
  if (composite < 45 || expectedReturn < hurdle) return "REJECT";
  return "HOLD";
}

function DecisionBadge({ decision }: { decision: "BUY" | "HOLD" | "REJECT" | null }) {
  if (!decision) return <span className="text-[12px] text-[#aeaeb2]">No scan yet</span>;
  const cfg = {
    BUY:    { bg: "#e3f5e9", color: "#1a7f3c", icon: "▲" },
    HOLD:   { bg: "#fef6e0", color: "#a3730a", icon: "◼" },
    REJECT: { bg: "#fde8e8", color: "#c0392b", icon: "▼" },
  }[decision];
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] font-semibold tracking-wider"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon} {decision}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const color = score >= 65 ? "#34c759" : score >= 45 ? "#ff9f0a" : "#ff3b30";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[#6e6e73]">{label}</span>
        <span className="font-medium text-[#1d1d1f]">{score.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-[#e5e5ea] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function ProfilePanel({ profile, token }: { profile: Profile; token: string }) {
  const hurdle = hurdleRate(profile);
  const [results, setResults] = useState<MarketResult[]>([]);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/market/results?universe=${profile.universe_key}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setResults(json.results ?? []);
      setScannedAt(json.scanned_at ?? null);
    }
    setLoading(false);
  }, [profile.universe_key, token]);

  useEffect(() => { loadResults(); }, [loadResults]);

  async function runScan() {
    setScanning(true);
    await fetch("/api/market/scan", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ universe: profile.universe_key }),
    });
    await loadResults();
    setScanning(false);
  }

  const noResults = results.every((r) => r.scanned_at === null);
  const buy    = results.filter((r) => computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === "BUY").length;
  const hold   = results.filter((r) => computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === "HOLD").length;
  const reject = results.filter((r) => computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === "REJECT").length;

  return (
    <div className="mb-10">
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[22px] font-semibold text-[#1d1d1f]">{profile.name}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#6e6e73] font-medium">
                {UNIVERSE_LABELS[profile.universe_key] ?? profile.universe_key}
              </span>
            </div>
            <p className="text-[13px] text-[#6e6e73]">
              {profile.investment_period === "1yr" ? "Short-term · 1 yr" : profile.investment_period === "3yr" ? "Medium-term · 3 yrs" : "Long-term · 5+ yrs"}
              {scannedAt && ` · Last scan ${new Date(scannedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
            </p>
            {!noResults && (
              <div className="flex gap-3 mt-2">
                {buy    > 0 && <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "#e3f5e9", color: "#1a7f3c" }}>▲ {buy} BUY</span>}
                {hold   > 0 && <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "#fef6e0", color: "#a3730a" }}>◼ {hold} HOLD</span>}
                {reject > 0 && <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "#fde8e8", color: "#c0392b" }}>▼ {reject} REJECT</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[11px] text-[#aeaeb2]">Hurdle Rate</p>
              <p className="text-[26px] font-semibold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</p>
            </div>
            <button onClick={runScan} disabled={scanning || loading}
              className="px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#0071e3" }}>
              {scanning ? "Scanning…" : "Scan Now"}
            </button>
          </div>
        </div>
      </div>

      {/* No results yet */}
      {loading && <p className="text-center text-[13px] text-[#aeaeb2] py-6">Loading…</p>}

      {!loading && noResults && (
        <div className="bg-white rounded-2xl border border-black/[0.08] p-8 text-center">
          <p className="text-[#6e6e73] text-[14px] mb-1">No scan results yet for this profile.</p>
          <p className="text-[12px] text-[#aeaeb2]">Click <strong>Scan Now</strong> to run the first analysis.</p>
        </div>
      )}

      {/* Stock results */}
      {!loading && !noResults && (
        <div className="space-y-2">
          {results.map((stock) => {
            const decision = computeDecision(stock.composite_score, stock.confidence, stock.expected_return, hurdle, profile.investment_period);
            const excess = stock.expected_return != null ? stock.expected_return - hurdle : null;
            const isExpanded = expanded === stock.symbol;

            return (
              <div key={stock.symbol} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                <button className="w-full text-left px-6 py-4 hover:bg-[#fafafa] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : stock.symbol)}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[18px] font-semibold text-[#1d1d1f]">{stock.symbol}</span>
                          <span className="text-[10px] text-[#aeaeb2] hidden sm:block">{stock.exchange}</span>
                        </div>
                        <p className="text-[12px] text-[#6e6e73] truncate max-w-[180px]">{stock.company_name}</p>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#6e6e73] hidden sm:block">{stock.sector}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[18px] font-semibold text-[#1d1d1f]">
                        {stock.price != null ? `$${stock.price.toFixed(2)}` : "—"}
                      </span>
                      {stock.change_pct != null && (
                        <span className="text-[12px] font-medium" style={{ color: stock.change_pct >= 0 ? "#34c759" : "#ff3b30" }}>
                          {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {stock.composite_score != null && (
                        <span className="text-[12px] text-[#6e6e73] hidden sm:block">
                          Composite <span className="font-semibold text-[#1d1d1f]">{stock.composite_score.toFixed(1)}</span>
                        </span>
                      )}
                      <DecisionBadge decision={decision} />
                      <span className="text-[#aeaeb2] text-[11px]">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-[#f0f0f0]">
                    {stock.composite_score === null ? (
                      <p className="mt-4 text-[13px] text-[#6e6e73] text-center">No AI scores yet.</p>
                    ) : (
                      <div className="mt-5 grid sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">Agent Scores</p>
                          <ScoreBar label="Forensic — Business Moat (Claude)"  score={stock.forensic_score} />
                          <ScoreBar label="Macro — Economic Backdrop (Gemini)" score={stock.macro_score} />
                          <ScoreBar label="Asymmetry — Risk/Reward (DeepSeek)" score={stock.asymmetry_score} />
                          <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                            <ScoreBar label="Composite (40 / 30 / 30)" score={stock.composite_score} />
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">
                            Hurdle Analysis · {hurdle.toFixed(1)}% required
                          </p>
                          <div className="space-y-2.5">
                            {[
                              ["Expected Return", `${stock.expected_return?.toFixed(1) ?? "—"}%`, stock.expected_return != null ? (stock.expected_return >= hurdle ? "#34c759" : "#ff3b30") : "#6e6e73"],
                              ["Hurdle Rate",     `${hurdle.toFixed(1)}%`,                        "#1d1d1f"],
                              ["Excess Return",   excess != null ? `${excess >= 0 ? "+" : ""}${excess.toFixed(1)}%` : "—", excess != null ? (excess >= 0 ? "#34c759" : "#ff3b30") : "#6e6e73"],
                              ["Confidence",      `${stock.confidence?.toFixed(1) ?? "—"}%`,      "#1d1d1f"],
                            ].map(([label, value, color]) => (
                              <div key={label as string} className="flex justify-between">
                                <span className="text-[13px] text-[#6e6e73]">{label as string}</span>
                                <span className="text-[13px] font-semibold" style={{ color: color as string }}>{value as string}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                            <DecisionBadge decision={decision} />
                            {stock.decision_summary && (
                              <p className="mt-3 text-[13px] text-[#3a3a3c] leading-relaxed">{stock.decision_summary}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {stock.scanned_at && (
                      <p className="mt-4 text-[11px] text-[#aeaeb2]">
                        Scanned {new Date(stock.scanned_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MarketPage() {
  const router = useRouter();
  const { profiles, profilesLoaded, userEmail, isSuperuser } = useScan();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!profilesLoaded) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
    });
  }, [profilesLoaded, router]);

  if (!profilesLoaded || !token) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={APPLE}>
        <p className="text-[#6e6e73] text-[15px]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={APPLE}>
      {/* Nav */}
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1d1d1f]">Finance Decision Machine</span>
          <div className="flex items-center gap-5">
            <span className="text-[13px] text-[#6e6e73] hidden sm:block">{userEmail}</span>
            {isSuperuser && (
              <Link href="/admin/prompts" className="text-[13px] text-[#a3730a] hover:underline font-medium">Admin</Link>
            )}
            <button onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 pb-24">

        {/* No profiles → prompt to create */}
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="text-[48px] mb-4">📊</div>
            <h1 className="text-[28px] font-semibold text-[#1d1d1f] mb-2">Welcome to Market Intelligence</h1>
            <p className="text-[15px] text-[#6e6e73] mb-2 max-w-md">
              Create your first investment profile to start scanning stocks and seeing AI-powered BUY / HOLD / REJECT signals.
            </p>
            <p className="text-[13px] text-[#aeaeb2] mb-8 max-w-md">
              Choose a stock universe (MEGA Cap, S&P 500, a sector, or manual picks), then set your hurdle rate.
            </p>
            <Link href="/profile/new"
              className="px-8 py-3 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "#0071e3" }}>
              Create Your First Profile →
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <h1 className="text-[34px] font-semibold text-[#1d1d1f] tracking-tight">Market Intelligence</h1>
                <p className="mt-1 text-[15px] text-[#6e6e73]">AI-powered signals based on your investment profiles · Auto-scanned weekdays 9 AM UTC</p>
              </div>
              <Link href="/profile/new"
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[#0071e3] bg-[#f0f6ff] hover:bg-[#e0efff] transition-colors">
                + New Profile
              </Link>
            </div>

            {/* One panel per profile */}
            {profiles.map((profile) => (
              <ProfilePanel key={profile.id} profile={profile} token={token} />
            ))}
          </>
        )}
      </div>

      <footer className="border-t border-black/[0.06] py-6 text-center">
        <p className="text-[12px] text-[#aeaeb2]">Copyright © 2026 Finance Decision Machine. All rights reserved.</p>
      </footer>
    </div>
  );
}
