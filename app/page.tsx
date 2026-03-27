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

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const config: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    BUY:    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: "▲" },
    HOLD:   { bg: "bg-amber-400/10",   text: "text-amber-400",   border: "border-amber-400/30",   icon: "◼" },
    REJECT: { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30",     icon: "▼" },
  };
  const c = config[decision] ?? config["HOLD"];
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-sm font-bold tracking-widest ${c.bg} ${c.text} ${c.border}`}>
      {c.icon} {decision}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const color = score >= 65 ? "bg-emerald-500" : score >= 45 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-300">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
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
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);

      try {
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.profile) {
          const p = json.profile;
          const hurdle_rate = p.inflation + p.borrowing + p.index_return + p.opex + p.alpha_target;
          setProfile({ ...p, hurdle_rate });
        }
      } catch {
        // Profile not set up yet — user will see the setup prompt
      }
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
      const res = await fetch("/api/scan", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <span className="text-zinc-500 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Finance Decision Machine</h1>
            <p className="mt-1 text-zinc-400 text-sm">Multi-agent analysis — Forensic · Macro · Asymmetry · Decision</p>
          </div>
          <div className="text-right text-xs text-zinc-500 space-y-1">
            <p className="font-mono">{userEmail}</p>
            <div className="flex gap-3 justify-end">
              <Link href="/profile" className="text-emerald-400 hover:text-emerald-200">Edit profile</Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
                className="text-zinc-500 hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Profile Summary */}
        {profile ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Your Investment Profile</h2>
              <Link href="/profile" className="text-xs text-zinc-500 hover:text-zinc-300">Edit</Link>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Time Period</div>
                <div className="text-sm font-semibold text-white">{PERIOD_LABELS[profile.investment_period]}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Hurdle Rate</div>
                <div className="text-sm font-mono font-bold text-emerald-400">{profile.hurdle_rate.toFixed(1)}%</div>
              </div>
              <div className="flex gap-3 text-xs text-zinc-500 flex-wrap items-end">
                {[
                  ["Inflation", profile.inflation],
                  ["Borrowing", profile.borrowing],
                  ["Index", profile.index_return],
                  ["OpEx", profile.opex],
                  ["Alpha", profile.alpha_target],
                ].map(([label, val]) => (
                  <span key={label as string}>{label}: <span className="text-zinc-300 font-mono">{(val as number).toFixed(1)}%</span></span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8 text-center">
            <p className="text-zinc-400 text-sm mb-3">Set up your investment profile to start scanning.</p>
            <Link
              href="/profile"
              className="inline-block px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-sm"
            >
              Set up profile →
            </Link>
          </div>
        )}

        {/* Scan Button */}
        {profile && (
          <div className="mb-8">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full px-6 py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {scanning ? `Scanning all 20 stocks… this takes ~2-3 min` : "Run Full Market Scan"}
            </button>
            {scanning && (
              <p className="mt-2 text-xs text-zinc-500 text-center animate-pulse">
                Running Forensic (Claude) → Macro (Gemini) → Asymmetry (DeepSeek) → Decision for each stock…
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-5 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {scanResult && (
          <div>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
                Scan Results
              </h2>
              <span className="text-xs text-zinc-500">
                {scanResult.total_passing} of {scanResult.total_scanned} stocks cleared {scanResult.profile.hurdle_rate.toFixed(1)}% hurdle
              </span>
            </div>

            <div className="space-y-4">
                {scanResult.results.map((stock) => (
                  <div key={stock.ticker} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    {/* Stock header row */}
                    <button
                      className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                      onClick={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold font-mono text-white">{stock.ticker}</span>
                        <DecisionBadge decision={stock.final_decision} />
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${stock.clears_hurdle ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {stock.expected_return?.toFixed(1)}% expected
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span>Composite: <span className="text-white font-mono">{stock.composite_score?.toFixed(1)}</span></span>
                        <span>Confidence: <span className="text-white font-mono">{stock.confidence?.toFixed(0)}%</span></span>
                        <span className="text-zinc-600">{expandedTicker === stock.ticker ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {expandedTicker === stock.ticker && (
                      <div className="px-6 pb-5 border-t border-zinc-800">
                        <div className="mt-4 mb-4">
                          <ScoreBar label="Forensic — Business Moat (Claude)" score={stock.forensic_score} />
                          <ScoreBar label="Macro — Economic Backdrop (Gemini)" score={stock.macro_score} />
                          <ScoreBar label="Asymmetry — Risk/Reward (DeepSeek)" score={stock.asymmetry_score} />
                          <div className="mt-3 pt-3 border-t border-zinc-800">
                            <ScoreBar label="Composite Score (40 / 30 / 30)" score={stock.composite_score} />
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-zinc-500 mb-4">
                          <span>Expected: <span className="text-emerald-400 font-mono">{stock.expected_return?.toFixed(1)}%</span></span>
                          <span>Required: <span className="text-zinc-300 font-mono">{stock.hurdle_rate?.toFixed(1)}%</span></span>
                          <span>Excess: <span className={`font-mono ${(stock.excess_return ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {(stock.excess_return ?? 0) >= 0 ? "+" : ""}{stock.excess_return?.toFixed(1)}%
                          </span></span>
                        </div>
                        {stock.decision_summary && (
                          <p className="text-zinc-300 text-sm leading-relaxed">{stock.decision_summary}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
