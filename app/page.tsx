"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useScan, StockResult } from "@/lib/ScanContext";

const PERIOD_LABELS: Record<string, string> = {
  "1yr": "Short-term · 1 yr",
  "3yr": "Medium-term · 3 yrs",
  "5yr": "Long-term · 5+ yrs",
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
  const { profiles, userEmail, profilesLoaded, scans, startScan } = useScan();
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // Auth guard — redirect to login if no session once profiles have been checked
  useEffect(() => {
    if (!profilesLoaded) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
    });
  }, [profilesLoaded, router]);

  if (!profilesLoaded) {
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
            <Link href="/profile" className="text-[13px] text-[#0071e3] hover:underline">Profiles</Link>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 pb-24">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-[40px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">Market Scan</h1>
          <p className="mt-1.5 text-[17px] text-[#6e6e73]">Multi-agent AI — Forensic · Macro · Asymmetry · Decision</p>
        </div>

        {/* No profiles */}
        {profiles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-10 text-center">
            <p className="text-[#6e6e73] text-[15px] mb-5">No investment profiles yet. Create one to start scanning.</p>
            <Link href="/profile/new"
              className="inline-block px-6 py-3 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "#0071e3" }}>
              Create Your First Profile →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {profiles.map((profile) => {
              const hurdle = profile.inflation + profile.borrowing + profile.index_return + profile.opex + profile.alpha_target;
              const scan = scans[profile.id];
              const isScanning = scan?.status === "running";
              const anyScanRunning = Object.values(scans).some((s) => s.status === "running");

              return (
                <div key={profile.id}>
                  {/* Profile card */}
                  <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-[22px] font-semibold text-[#1d1d1f]">{profile.name}</h2>
                        <p className="text-[13px] text-[#6e6e73] mt-0.5">{PERIOD_LABELS[profile.investment_period]}</p>
                        <div className="flex gap-4 mt-3 flex-wrap">
                          {[
                            ["Inflation", profile.inflation],
                            ["Borrowing", profile.borrowing],
                            ["Index", profile.index_return],
                            ["OpEx", profile.opex],
                            ["Alpha", profile.alpha_target],
                          ].map(([label, val]) => (
                            <div key={label as string}>
                              <p className="text-[10px] text-[#aeaeb2] uppercase tracking-wide">{label as string}</p>
                              <p className="text-[13px] font-medium text-[#3a3a3c]">{(val as number).toFixed(1)}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 ml-4">
                        <div className="text-right">
                          <p className="text-[11px] text-[#aeaeb2]">Hurdle Rate</p>
                          <p className="text-[26px] font-semibold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</p>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/profile/${profile.id}`}
                            className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#0071e3] bg-[#f0f6ff] hover:bg-[#e0efff] transition-colors">
                            Edit
                          </Link>
                          <button
                            onClick={() => startScan(profile.id, profile.name)}
                            disabled={isScanning || anyScanRunning}
                            className="px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: "#0071e3" }}>
                            {isScanning ? "Scanning…" : "Run Scan"}
                          </button>
                        </div>
                      </div>
                    </div>


                    {/* Failed state */}
                    {scan?.status === "failed" && (
                      <p className="mt-4 text-[12px] text-red-500 text-center border-t border-[#f0f0f0] pt-3">
                        Scan failed. Please try again.
                      </p>
                    )}
                  </div>

                  {/* Scan results */}
                  {scan?.status === "completed" && scan.results.length > 0 && (
                    <div className="pl-2">
                      <div className="flex items-baseline justify-between mb-3">
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Results — {profile.name}</h3>
                        <span className="text-[12px] text-[#6e6e73]">
                          {scan.total_passing} of {scan.total_scanned} cleared {scan.hurdle_rate.toFixed(1)}% hurdle
                        </span>
                      </div>
                      <div className="space-y-2">
                        {scan.results.map((stock: StockResult) => (
                          <div key={stock.ticker} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                            <button
                              className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-[#fafafa] transition-colors"
                              onClick={() => setExpandedTicker(expandedTicker === `${profile.id}-${stock.ticker}` ? null : `${profile.id}-${stock.ticker}`)}>
                              <div className="flex items-center gap-3">
                                <span className="text-[18px] font-semibold text-[#1d1d1f]">{stock.ticker}</span>
                                <DecisionBadge decision={stock.final_decision} />
                                <span className="text-[12px] px-2.5 py-1 rounded-lg font-medium"
                                  style={{ background: stock.clears_hurdle ? "#e3f5e9" : "#fde8e8", color: stock.clears_hurdle ? "#1a7f3c" : "#c0392b" }}>
                                  {stock.expected_return?.toFixed(1)}% expected
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-[12px] text-[#6e6e73]">
                                <span>Composite <span className="font-semibold text-[#1d1d1f]">{stock.composite_score?.toFixed(1)}</span></span>
                                <span className="text-[#aeaeb2]">{expandedTicker === `${profile.id}-${stock.ticker}` ? "▲" : "▼"}</span>
                              </div>
                            </button>

                            {expandedTicker === `${profile.id}-${stock.ticker}` && (
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
              );
            })}

            {/* Add another profile */}
            <Link href="/profile/new"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed border-[#d2d2d7] text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3] transition-colors text-[15px] font-medium">
              + Add Another Profile
            </Link>
          </div>
        )}
      </div>

      <footer className="border-t border-black/[0.06] mt-16 py-6 text-center">
        <p className="text-[12px] text-[#aeaeb2]">Copyright © 2026 Finance Decision Machine. All rights reserved.</p>
      </footer>
    </div>
  );
}
