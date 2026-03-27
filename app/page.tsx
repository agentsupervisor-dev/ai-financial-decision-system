"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Profile {
  investment_period: "1yr" | "3yr" | "5yr";
  hurdle_rate: number;
  inflation: number;
  borrowing: number;
  index_return: number;
  opex: number;
  alpha_target: number;
}

interface StockResult {
  ticker: string;
  final_decision: string | null;
  composite_score: number | null;
  forensic_score: number | null;
  macro_score: number | null;
  asymmetry_score: number | null;
  confidence: number | null;
  expected_return: number | null;
  hurdle_rate: number | null;
  excess_return: number | null;
  clears_hurdle: boolean | null;
  decision_summary: string | null;
  error?: string;
}

interface ScanResult {
  profile: { investment_period: string; hurdle_rate: number };
  total_scanned: number;
  total_passing: number;
  results: StockResult[];
}

const PERIOD_LABELS: Record<string, string> = {
  "1yr": "Short-term · 1 year",
  "3yr": "Medium-term · 3 years",
  "5yr": "Long-term · 5+ years",
};

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const config: Record<string, { bg: string; color: string; icon: string }> = {
    BUY:    { bg: "#e3f5e9", color: "#1a7f3c", icon: "▲" },
    HOLD:   { bg: "#fef6e0", color: "#a3730a", icon: "◼" },
    REJECT: { bg: "#fde8e8", color: "#c0392b", icon: "▼" },
  };
  const c = config[decision] ?? config["HOLD"];
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] font-semibold tracking-wider"
      style={{ background: c.bg, color: c.color }}>
      {c.icon} {decision}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const color = score >= 65 ? "#34c759" : score >= 45 ? "#ff9f0a" : "#ff3b30";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[12px] mb-1.5">
        <span className="text-[#6e6e73]">{label}</span>
        <span className="font-medium text-[#1d1d1f]">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-[#e5e5ea] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUserEmail(session.user.email ?? null);
      try {
        const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const json = await res.json();
        if (json.profile) {
          const p = json.profile;
          setProfile({ ...p, hurdle_rate: p.inflation + p.borrowing + p.index_return + p.opex + p.alpha_target });
        }
      } catch { /* no profile yet */ }
      setAuthLoading(false);
    }
    loadSession();
  }, [router]);

  async function handleScan() {
    setScanning(true);
    setError(null);
    setScanResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
    try {
      const res = await fetch("/api/scan", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setScanResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  if (authLoading) {
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
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1d1d1f]">Finance Decision Machine</span>
          <div className="flex items-center gap-5">
            <span className="text-[13px] text-[#6e6e73] hidden sm:block">{userEmail}</span>
            <Link href="/profile" className="text-[13px] text-[#0071e3] hover:underline">Edit Profile</Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-[40px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">Market Scan</h1>
          <p className="mt-1.5 text-[17px] text-[#6e6e73]">Multi-agent AI analysis — Forensic · Macro · Asymmetry · Decision</p>
        </div>

        {/* Profile card */}
        {profile ? (
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[12px] font-semibold text-[#6e6e73] uppercase tracking-widest mb-1">Your Profile</p>
                <p className="text-[15px] font-medium text-[#1d1d1f]">{PERIOD_LABELS[profile.investment_period]}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#6e6e73] mb-0.5">Hurdle Rate</p>
                <p className="text-[28px] font-semibold" style={{ color: "#0071e3" }}>{profile.hurdle_rate.toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex gap-4 flex-wrap pt-4 border-t border-[#f0f0f0]">
              {[
                ["Inflation",  profile.inflation],
                ["Borrowing",  profile.borrowing],
                ["Index",      profile.index_return],
                ["OpEx",       profile.opex],
                ["Alpha",      profile.alpha_target],
              ].map(([label, val]) => (
                <div key={label as string} className="text-center">
                  <p className="text-[11px] text-[#aeaeb2]">{label as string}</p>
                  <p className="text-[13px] font-medium text-[#1d1d1f]">{(val as number).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-8 mb-6 text-center">
            <p className="text-[15px] text-[#6e6e73] mb-4">Set up your investment profile to start scanning.</p>
            <Link href="/profile"
              className="inline-block px-6 py-3 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "#0071e3" }}>
              Set up Profile →
            </Link>
          </div>
        )}

        {/* Scan button */}
        {profile && (
          <div className="mb-8">
            <button onClick={handleScan} disabled={scanning}
              className="w-full py-4 rounded-2xl text-[17px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#0071e3" }}>
              {scanning ? "Analyzing stocks…" : "Run Full Market Scan"}
            </button>
            {scanning && (
              <p className="mt-2.5 text-[12px] text-[#aeaeb2] text-center animate-pulse">
                Forensic (Claude) → Macro (Gemini) → Asymmetry (DeepSeek) → Decision
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-[14px] text-red-600 mb-6">{error}</div>
        )}

        {/* Results */}
        {scanResult && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Results</h2>
              <span className="text-[13px] text-[#6e6e73]">
                {scanResult.total_passing} of {scanResult.total_scanned} cleared hurdle
              </span>
            </div>

            <div className="space-y-3">
              {scanResult.results.map((stock) => (
                <div key={stock.ticker} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                  <button
                    className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors"
                    onClick={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}>
                    <div className="flex items-center gap-3">
                      <span className="text-[20px] font-semibold text-[#1d1d1f]">{stock.ticker}</span>
                      <DecisionBadge decision={stock.final_decision} />
                      <span className="text-[12px] px-2.5 py-1 rounded-lg font-medium"
                        style={{ background: stock.clears_hurdle ? "#e3f5e9" : "#fde8e8", color: stock.clears_hurdle ? "#1a7f3c" : "#c0392b" }}>
                        {stock.expected_return?.toFixed(1)}% expected
                      </span>
                    </div>
                    <div className="flex items-center gap-5 text-[12px] text-[#6e6e73]">
                      <span>Composite <span className="font-semibold text-[#1d1d1f]">{stock.composite_score?.toFixed(1)}</span></span>
                      <span>Confidence <span className="font-semibold text-[#1d1d1f]">{stock.confidence?.toFixed(0)}%</span></span>
                      <span className="text-[#aeaeb2]">{expandedTicker === stock.ticker ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expandedTicker === stock.ticker && (
                    <div className="px-6 pb-6 border-t border-[#f0f0f0]">
                      <div className="mt-5 mb-4">
                        <ScoreBar label="Forensic — Business Moat (Claude)" score={stock.forensic_score} />
                        <ScoreBar label="Macro — Economic Backdrop (Gemini)" score={stock.macro_score} />
                        <ScoreBar label="Asymmetry — Risk/Reward (DeepSeek)" score={stock.asymmetry_score} />
                        <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                          <ScoreBar label="Composite Score (40 / 30 / 30)" score={stock.composite_score} />
                        </div>
                      </div>
                      <div className="flex gap-5 text-[13px] text-[#6e6e73] mb-4">
                        <span>Expected <span className="font-semibold" style={{ color: "#34c759" }}>{stock.expected_return?.toFixed(1)}%</span></span>
                        <span>Required <span className="font-semibold text-[#1d1d1f]">{stock.hurdle_rate?.toFixed(1)}%</span></span>
                        <span>Excess <span className="font-semibold" style={{ color: (stock.excess_return ?? 0) >= 0 ? "#34c759" : "#ff3b30" }}>
                          {(stock.excess_return ?? 0) >= 0 ? "+" : ""}{stock.excess_return?.toFixed(1)}%
                        </span></span>
                      </div>
                      {stock.decision_summary && (
                        <p className="text-[14px] text-[#3a3a3c] leading-relaxed">{stock.decision_summary}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] mt-16 py-6 text-center">
        <p className="text-[12px] text-[#aeaeb2]">Copyright © 2025 Finance Decision Machine. All rights reserved.</p>
      </footer>
    </div>
  );
}
