"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useScan, Profile } from "@/lib/ScanContext";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

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

function computeDecision(
  composite: number | null,
  confidence: number | null,
  expectedReturn: number | null,
  hurdleRate: number,
  investmentPeriod: string,
): "BUY" | "HOLD" | "REJECT" | null {
  if (composite === null || confidence === null || expectedReturn === null) return null;
  const thresholds: Record<string, number> = { "1yr": 65, "3yr": 55, "5yr": 48 };
  const threshold = thresholds[investmentPeriod] ?? 55;
  const clears = expectedReturn >= hurdleRate;
  if (composite >= threshold && confidence >= 50 && clears) return "BUY";
  if (composite < 45 || !clears) return "REJECT";
  return "HOLD";
}

function DecisionBadge({ decision }: { decision: "BUY" | "HOLD" | "REJECT" | null }) {
  if (!decision) return <span className="text-[12px] text-[#aeaeb2]">No scan yet</span>;
  const config = {
    BUY:    { bg: "#e3f5e9", color: "#1a7f3c", icon: "▲" },
    HOLD:   { bg: "#fef6e0", color: "#a3730a", icon: "◼" },
    REJECT: { bg: "#fde8e8", color: "#c0392b", icon: "▼" },
  };
  const c = config[decision];
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] font-semibold tracking-wider"
      style={{ background: c.bg, color: c.color }}>
      {c.icon} {decision}
    </span>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  if (score === null) return null;
  const barColor = score >= 65 ? "#34c759" : score >= 45 ? "#ff9f0a" : "#ff3b30";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[#6e6e73]">{label}</span>
        <span className="font-medium" style={{ color }}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-[#e5e5ea] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: barColor }} />
      </div>
    </div>
  );
}

export default function MarketPage() {
  const router = useRouter();
  const { profiles, profilesLoaded } = useScan();
  const [token, setToken] = useState<string | null>(null);

  const [results, setResults] = useState<MarketResult[]>([]);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  // Auth guard
  useEffect(() => {
    if (!profilesLoaded) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
    });
  }, [profilesLoaded, router]);

  // Default to first profile
  useEffect(() => {
    if (profiles.length > 0 && selectedProfileId === null) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  const loadResults = useCallback(async (tok: string) => {
    setLoading(true);
    const res = await fetch("/api/market/results?universe=mega10", {
      headers: { Authorization: `Bearer ${tok}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setResults(json.results ?? []);
      setScannedAt(json.scanned_at ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) loadResults(token);
  }, [token, loadResults]);

  async function runScan() {
    if (!token) return;
    setScanning(true);
    await fetch("/api/market/scan", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ universe: "mega10" }),
    });
    await loadResults(token);
    setScanning(false);
  }

  const selectedProfile: Profile | null = profiles.find((p) => p.id === selectedProfileId) ?? null;
  const hurdleRate = selectedProfile
    ? selectedProfile.inflation + selectedProfile.borrowing + selectedProfile.index_return + selectedProfile.opex + selectedProfile.alpha_target
    : 0;
  const investmentPeriod = selectedProfile?.investment_period ?? "3yr";

  const formatPrice = (p: number | null) => p != null ? `$${p.toFixed(2)}` : "—";
  const formatChange = (c: number | null) => {
    if (c == null) return null;
    const sign = c >= 0 ? "+" : "";
    return `${sign}${c.toFixed(2)}%`;
  };
  const formatScannedAt = (s: string | null) => {
    if (!s) return null;
    return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (!profilesLoaded || loading) {
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
          <div className="flex items-center gap-5">
            <Link href="/" className="text-[15px] font-semibold text-[#1d1d1f]">Finance Decision Machine</Link>
            <Link href="/market" className="text-[13px] text-[#0071e3] font-medium">Market</Link>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">Dashboard</Link>
            <Link href="/profile" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">Profiles</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-[34px] font-semibold text-[#1d1d1f] tracking-tight">Market Intelligence</h1>
            <p className="mt-1 text-[15px] text-[#6e6e73]">MEGA Cap · Top 10 by Market Cap · Auto-scanned weekdays 9 AM UTC</p>
            {scannedAt && (
              <p className="mt-1 text-[12px] text-[#aeaeb2]">Last scan: {formatScannedAt(scannedAt)}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Profile selector */}
            {profiles.length > 0 && (
              <div className="flex flex-col">
                <label className="text-[11px] text-[#aeaeb2] mb-1">Profile (hurdle rate)</label>
                <select
                  value={selectedProfileId ?? ""}
                  onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                  className="rounded-xl border border-[#d2d2d7] bg-white px-3 py-2 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]">
                  {profiles.map((p) => {
                    const h = p.inflation + p.borrowing + p.index_return + p.opex + p.alpha_target;
                    return (
                      <option key={p.id} value={p.id}>{p.name} — {h.toFixed(1)}% hurdle</option>
                    );
                  })}
                </select>
              </div>
            )}
            {/* Manual scan trigger (superuser/dev) */}
            <button
              onClick={runScan}
              disabled={scanning}
              className="px-5 py-2 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 self-end"
              style={{ background: "#0071e3" }}>
              {scanning ? "Scanning…" : "Scan Now"}
            </button>
          </div>
        </div>

        {/* No scan results yet */}
        {results.every((r) => r.scanned_at === null) && !scanning && (
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-10 text-center mb-6">
            <p className="text-[#6e6e73] text-[15px] mb-3">No scan results yet.</p>
            <p className="text-[13px] text-[#aeaeb2]">Click <strong>Scan Now</strong> to run the first analysis, or wait for the daily 9 AM auto-scan.</p>
          </div>
        )}

        {/* Stock cards */}
        <div className="space-y-3">
          {results.map((stock) => {
            const decision = computeDecision(
              stock.composite_score, stock.confidence,
              stock.expected_return, hurdleRate, investmentPeriod,
            );
            const clears = stock.expected_return != null && stock.expected_return >= hurdleRate;
            const excess = stock.expected_return != null ? stock.expected_return - hurdleRate : null;
            const isExpanded = expanded === stock.symbol;
            const hasScores = stock.composite_score !== null;

            return (
              <div key={stock.symbol} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                {/* Row */}
                <button
                  className="w-full text-left px-6 py-4 hover:bg-[#fafafa] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : stock.symbol)}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Left: symbol + company */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[20px] font-semibold text-[#1d1d1f]">{stock.symbol}</span>
                          <span className="text-[11px] text-[#aeaeb2] hidden sm:block">{stock.exchange}</span>
                        </div>
                        <p className="text-[12px] text-[#6e6e73] truncate max-w-[200px]">{stock.company_name}</p>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#6e6e73]">{stock.sector}</span>
                      </div>
                    </div>

                    {/* Middle: price */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-[20px] font-semibold text-[#1d1d1f]">{formatPrice(stock.price)}</span>
                      {stock.change_pct != null && (
                        <span className="text-[13px] font-medium" style={{ color: stock.change_pct >= 0 ? "#34c759" : "#ff3b30" }}>
                          {formatChange(stock.change_pct)}
                        </span>
                      )}
                    </div>

                    {/* Right: composite + decision */}
                    <div className="flex items-center gap-4">
                      {hasScores && (
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] text-[#aeaeb2]">Composite</p>
                          <p className="text-[18px] font-semibold text-[#1d1d1f]">{stock.composite_score?.toFixed(1)}</p>
                        </div>
                      )}
                      <DecisionBadge decision={decision} />
                      <span className="text-[#aeaeb2] text-[12px]">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-[#f0f0f0]">
                    {!hasScores ? (
                      <p className="mt-5 text-[13px] text-[#6e6e73] text-center">
                        No AI scan data yet — click <strong>Scan Now</strong> to analyse this stock.
                      </p>
                    ) : (
                      <div className="mt-5 grid sm:grid-cols-2 gap-6">
                        {/* Scores */}
                        <div>
                          <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">Agent Scores</p>
                          <ScoreBar label="Forensic — Business Moat (Claude)"   score={stock.forensic_score}   color="#1d1d1f" />
                          <ScoreBar label="Macro — Economic Backdrop (Gemini)"  score={stock.macro_score}      color="#1d1d1f" />
                          <ScoreBar label="Asymmetry — Risk/Reward (DeepSeek)"  score={stock.asymmetry_score}  color="#1d1d1f" />
                          <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                            <ScoreBar label="Composite (40 / 30 / 30)" score={stock.composite_score} color="#0071e3" />
                          </div>
                        </div>

                        {/* Hurdle math */}
                        <div>
                          <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">
                            Hurdle Analysis · {selectedProfile?.name ?? "—"}
                          </p>
                          <div className="space-y-2.5">
                            {[
                              ["Expected Return", `${stock.expected_return?.toFixed(1) ?? "—"}%`, stock.expected_return != null ? (clears ? "#34c759" : "#ff3b30") : "#6e6e73"],
                              ["Hurdle Rate",     `${hurdleRate.toFixed(1)}%`,     "#1d1d1f"],
                              ["Excess Return",   excess != null ? `${excess >= 0 ? "+" : ""}${excess.toFixed(1)}%` : "—", excess != null ? (excess >= 0 ? "#34c759" : "#ff3b30") : "#6e6e73"],
                              ["Confidence",      `${stock.confidence?.toFixed(1) ?? "—"}%`, "#1d1d1f"],
                            ].map(([label, value, color]) => (
                              <div key={label as string} className="flex justify-between items-center">
                                <span className="text-[13px] text-[#6e6e73]">{label as string}</span>
                                <span className="text-[14px] font-semibold" style={{ color: color as string }}>{value as string}</span>
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

                    {/* Scan timestamp */}
                    {stock.scanned_at && (
                      <p className="mt-4 text-[11px] text-[#aeaeb2]">Scanned {formatScannedAt(stock.scanned_at)}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <footer className="border-t border-black/[0.06] py-6 text-center">
        <p className="text-[12px] text-[#aeaeb2]">Copyright © 2026 Finance Decision Machine. All rights reserved.</p>
      </footer>
    </div>
  );
}
