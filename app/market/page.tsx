"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useScan, Profile } from "@/lib/ScanContext";
import BuyModal from "@/app/components/BuyModal";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

const UNIVERSE_LABELS: Record<string, string> = {
  mega10: "MEGA Cap Top 10", nasdaq100: "NASDAQ 100", sp500: "S&P 500 Top 30",
  sector_tech: "Technology", sector_health: "Healthcare", sector_finance: "Financial",
  sector_energy: "Energy", sector_consumer: "Consumer", sector_industrial: "Industrial",
  manual: "Manual Picks",
};

interface MarketResult {
  symbol: string; company_name: string; sector: string; exchange: string;
  price: number | null; change_pct: number | null;
  forensic_score: number | null; macro_score: number | null; asymmetry_score: number | null;
  composite_score: number | null; confidence: number | null; expected_return: number | null;
  decision_summary: string | null; error: string | null; scanned_at: string | null;
}

function hurdleFor(p: Profile) {
  return p.inflation + p.borrowing + p.index_return + p.opex + p.alpha_target;
}

function computeDecision(
  composite: number | null, confidence: number | null,
  expectedReturn: number | null, hurdle: number, period: string,
): "BUY" | "HOLD" | "REJECT" | null {
  if (composite === null || confidence === null || expectedReturn === null) return null;
  const thresholds: Record<string, number> = { "1yr": 65, "3yr": 55, "5yr": 48 };
  const threshold = thresholds[period] ?? 55;
  if (composite >= threshold && confidence >= 50 && expectedReturn >= hurdle) return "BUY";
  if (composite < 45 || expectedReturn < hurdle) return "REJECT";
  return "HOLD";
}

function chip(symbol: string, bg: string, color: string) {
  return (
    <span key={symbol} className="inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: bg, color }}>{symbol}</span>
  );
}

// ── Summary Section ───────────────────────────────────────────────────────────
function SummarySection({ profiles, allResults }: { profiles: Profile[]; allResults: Record<number, MarketResult[]> }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  type Signal = { symbol: string; company_name: string; sector: string; profile_name: string };
  const buys: Signal[] = [], holds: Signal[] = [], rejects: Signal[] = [];
  const seen = new Set<string>();

  for (const profile of profiles) {
    const results = allResults[profile.id] ?? [];
    const hurdle = hurdleFor(profile);
    for (const r of results) {
      if (!r.scanned_at) continue;
      if (seen.has(r.symbol)) continue;
      seen.add(r.symbol);
      const d = computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period);
      const sig = { symbol: r.symbol, company_name: r.company_name, sector: r.sector, profile_name: profile.name };
      if (d === "BUY") buys.push(sig);
      else if (d === "HOLD") holds.push(sig);
      else if (d === "REJECT") rejects.push(sig);
    }
  }

  const total = buys.length + holds.length + rejects.length;
  const hasData = total > 0;

  // Group buys by sector
  const buysBySector = buys.reduce((acc, s) => {
    acc[s.sector] = [...(acc[s.sector] ?? []), s.symbol]; return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="rounded-2xl border border-black/[0.08] shadow-sm bg-white mb-6 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
        <div>
          <span className="text-[20px] font-bold text-[#1d1d1f]">{greeting} 👋</span>
          <span className="text-[14px] text-[#6e6e73] ml-3">
            {hasData ? `${total} signals across ${profiles.length} profile${profiles.length !== 1 ? "s" : ""}` : "Run a scan to see your morning summary"}
          </span>
        </div>
        {hasData && <span className="text-[12px] text-[#aeaeb2]">Auto-scan weekdays 9 AM UTC</span>}
      </div>

      {!hasData ? (
        <div className="px-6 py-10 text-center">
          <p className="text-[15px] text-[#aeaeb2]">Click <strong className="text-[#1d1d1f]">Scan Now</strong> on any profile below to see your market summary.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-[#f0f0f0]">
          {/* BUY */}
          <div className="p-6 min-h-[180px]" style={{ background: "linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%)" }}>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-[56px] font-black leading-none" style={{ color: "#16a34a" }}>{buys.length}</span>
              <div className="mb-2">
                <span className="block text-[13px] font-bold tracking-wider uppercase" style={{ color: "#16a34a" }}>▲ BUY</span>
                <span className="block text-[11px] font-medium" style={{ color: "#4ade80" }}>above hurdle rate</span>
              </div>
            </div>
            {buys.length === 0 ? (
              <p className="text-[13px] mt-4" style={{ color: "#86efac" }}>No buy signals today</p>
            ) : (
              <div className="mt-3 space-y-2">
                {Object.entries(buysBySector).map(([sector, symbols]) => (
                  <div key={sector} className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium w-24 shrink-0 truncate" style={{ color: "#22c55e" }}>{sector}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {symbols.map((s) => chip(s, "rgba(22,163,74,0.12)", "#15803d"))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HOLD */}
          <div className="p-6 min-h-[180px]" style={{ background: "linear-gradient(160deg, #fff7ed 0%, #ffedd5 100%)" }}>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-[56px] font-black leading-none" style={{ color: "#ea580c" }}>{holds.length}</span>
              <div className="mb-2">
                <span className="block text-[13px] font-bold tracking-wider uppercase" style={{ color: "#ea580c" }}>◼ HOLD</span>
                <span className="block text-[11px] font-medium" style={{ color: "#fb923c" }}>monitor before acting</span>
              </div>
            </div>
            {holds.length === 0 ? (
              <p className="text-[13px] mt-4" style={{ color: "#fdba74" }}>No hold signals today</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {holds.map((s) => chip(s.symbol, "rgba(234,88,12,0.12)", "#c2410c"))}
              </div>
            )}
          </div>

          {/* REJECT */}
          <div className="p-6 min-h-[180px]" style={{ background: "linear-gradient(160deg, #fff1f2 0%, #ffe4e6 100%)" }}>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-[56px] font-black leading-none" style={{ color: "#dc2626" }}>{rejects.length}</span>
              <div className="mb-2">
                <span className="block text-[13px] font-bold tracking-wider uppercase" style={{ color: "#dc2626" }}>▼ REJECT</span>
                <span className="block text-[11px] font-medium" style={{ color: "#f87171" }}>below return threshold</span>
              </div>
            </div>
            {rejects.length === 0 ? (
              <p className="text-[13px] mt-4" style={{ color: "#fca5a5" }}>No reject signals today</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rejects.slice(0, 30).map((s) => chip(s.symbol, "rgba(220,38,38,0.10)", "#b91c1c"))}
                {rejects.length > 30 && (
                  <span className="text-[12px] self-center" style={{ color: "#fca5a5" }}>+{rejects.length - 30} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────
function ProfilePanel({
  profile, token, results, scannedAt, loading, userBalance, onRefresh, onDelete,
}: {
  profile: Profile; token: string; results: MarketResult[]; scannedAt: string | null;
  loading: boolean; userBalance: number | null; onRefresh: () => void; onDelete: (id: number) => void;
}) {
  const hurdle = hurdleFor(profile);
  const [expanded, setExpanded] = useState(false);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [buyTarget, setBuyTarget] = useState<MarketResult | null>(null);

  async function runScan() {
    setScanning(true);
    const body: Record<string, unknown> = { universe: profile.universe_key };
    if (profile.universe_key === "manual") body.profile_id = profile.id;
    await fetch("/api/market/scan", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onRefresh();
    setScanning(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/profile/${profile.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    onDelete(profile.id);
  }

  // Sort: BUY → HOLD → REJECT → no data
  const ORDER = { BUY: 0, HOLD: 1, REJECT: 2, null: 3 };
  const sortedResults = [...results].sort((a, b) => {
    const da = computeDecision(a.composite_score, a.confidence, a.expected_return, hurdle, profile.investment_period);
    const db = computeDecision(b.composite_score, b.confidence, b.expected_return, hurdle, profile.investment_period);
    return (ORDER[da ?? "null"] ?? 3) - (ORDER[db ?? "null"] ?? 3);
  });

  const buys    = results.filter((r) => computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === "BUY");
  const holds   = results.filter((r) => computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === "HOLD");
  const rejects = results.filter((r) => computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === "REJECT");
  const hasData = results.some((r) => r.scanned_at !== null);

  const periodLabel = profile.investment_period === "1yr" ? "1yr" : profile.investment_period === "3yr" ? "3yr" : "5yr+";

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden h-fit">
      {/* Header row — always visible */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: profile info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity min-w-0">
              <span className="text-[15px]">{expanded ? "▼" : "▶"}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[20px] font-bold text-[#1d1d1f]">{profile.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#6e6e73] font-medium shrink-0">
                    {UNIVERSE_LABELS[profile.universe_key] ?? profile.universe_key}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#6e6e73] font-medium shrink-0">{periodLabel}</span>
                </div>
                {/* Signal summary */}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {loading ? (
                    <span className="text-[13px] text-[#aeaeb2]">Loading…</span>
                  ) : !hasData ? (
                    <span className="text-[13px] text-[#aeaeb2]">Not scanned yet</span>
                  ) : (
                    <>
                      {buys.length > 0 && <span className="text-[13px] font-bold" style={{ color: "#16a34a" }}>▲ {buys.length} BUY</span>}
                      {holds.length > 0 && <span className="text-[13px] font-bold" style={{ color: "#ea580c" }}>◼ {holds.length} HOLD</span>}
                      {rejects.length > 0 && <span className="text-[13px] font-bold" style={{ color: "#dc2626" }}>▼ {rejects.length} REJECT</span>}
                      {scannedAt && (
                        <span className="text-[10px] text-[#aeaeb2]">
                          · {new Date(scannedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Right: hurdle rate + actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-[#aeaeb2]">Hurdle</p>
              <p className="text-[18px] font-semibold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</p>
            </div>
            <div className="flex gap-1.5">
              <Link href={`/profile/${profile.id}`}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#6e6e73] bg-[#f5f5f7] hover:bg-[#e5e5ea] transition-colors">
                Edit
              </Link>
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                Delete
              </button>
              <button onClick={runScan} disabled={scanning || loading}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#0071e3" }}>
                {scanning ? "Scanning…" : "Scan Now"}
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-[#3a3a3c]">Delete <strong>{profile.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#6e6e73] bg-[#f5f5f7]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white bg-red-500 disabled:opacity-40">
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded: stock list sorted BUY → HOLD → REJECT */}
      {expanded && (
        <div className="border-t border-[#f0f0f0]">
          {!hasData ? (
            <p className="text-[12px] text-[#aeaeb2] text-center py-5">No scan data — click Scan Now.</p>
          ) : scannedAt && (
            <p className="text-[10px] text-[#aeaeb2] px-4 pt-2 pb-0">
              Scores are AI estimates from the scan on {new Date(scannedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. The same stock may score differently across profiles if scanned at different times — LLM outputs vary slightly between runs.
            </p>
          ) && (
            <div>
              {/* Group headers */}
              {(["BUY", "HOLD", "REJECT"] as const).map((group) => {
                const groupResults = sortedResults.filter((r) =>
                  computeDecision(r.composite_score, r.confidence, r.expected_return, hurdle, profile.investment_period) === group
                );
                if (groupResults.length === 0) return null;
                const groupColor = group === "BUY" ? "#1a7f3c" : group === "HOLD" ? "#c2410c" : "#c0392b";
                const groupBg    = group === "BUY" ? "#e3f5e9" : group === "HOLD" ? "#fef6e0" : "#fde8e8";
                const groupIcon  = group === "BUY" ? "▲" : group === "HOLD" ? "◼" : "▼";

                return (
                  <div key={group}>
                    {/* Group label */}
                    <div className="px-5 py-2 flex items-center gap-2" style={{ background: groupBg }}>
                      <span className="text-[11px] font-bold tracking-wider" style={{ color: groupColor }}>
                        {groupIcon} {group} ({groupResults.length})
                      </span>
                    </div>
                    {/* Stock rows */}
                    {groupResults.map((stock) => {
                      const isOpen = expandedStock === `${profile.id}-${stock.symbol}`;
                      const excess = stock.expected_return != null ? stock.expected_return - hurdle : null;

                      return (
                        <div key={stock.symbol} className="border-b border-[#f0f0f0] last:border-0">
                          {/* Compact row */}
                          <div className="flex items-center px-4 py-2.5 gap-2 hover:bg-[#fafafa] transition-colors">
                            <button className="flex-1 text-left"
                              onClick={() => setExpandedStock(isOpen ? null : `${profile.id}-${stock.symbol}`)}>
                              <div className="grid items-center gap-x-2 text-[12px]"
                                style={{ gridTemplateColumns: "3.5rem 1fr auto auto auto auto 1rem" }}>
                                <span className="font-bold text-[#1d1d1f] text-[13px]">{stock.symbol}</span>
                                <span className="text-[#6e6e73] truncate">{stock.company_name}
                                  <span className="text-[#aeaeb2] ml-1.5 hidden sm:inline">{stock.sector}</span>
                                </span>
                                <span className="font-semibold text-[#1d1d1f] text-right pr-1">
                                  {stock.price != null ? `$${stock.price.toFixed(2)}` : "—"}
                                </span>
                                <span className="text-right pr-1 font-medium"
                                  style={{ color: (stock.change_pct ?? 0) >= 0 ? "#34c759" : "#ff3b30" }}>
                                  {stock.change_pct != null ? `${stock.change_pct >= 0 ? "+" : ""}${stock.change_pct.toFixed(1)}%` : ""}
                                </span>
                                <span className="text-[#6e6e73] text-right pr-1">
                                  {stock.composite_score != null && <>Score <b className="text-[#1d1d1f]">{stock.composite_score.toFixed(0)}</b></>}
                                </span>
                                <span className="font-semibold text-right pr-1" style={{ color: groupColor }}>
                                  {stock.expected_return != null ? `${stock.expected_return.toFixed(1)}%` : ""}
                                </span>
                                <span className="text-[10px] text-[#aeaeb2] text-right">{isOpen ? "▲" : "▼"}</span>
                              </div>
                            </button>
                            {/* Buy button — shown for all scanned stocks */}
                            {stock.composite_score != null && (
                              <button
                                onClick={() => { setBuyTarget(stock); }}
                                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                                style={{ background: group === "BUY" ? "#16a34a" : "#6e6e73" }}>
                                Buy
                              </button>
                            )}
                          </div>

                          {/* Expanded stock detail */}
                          {isOpen && (
                            <div className="px-5 pb-4 pt-1 bg-[#fafafa] grid sm:grid-cols-3 gap-4">
                              {/* Score bars */}
                              <div>
                                <p className="text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-2">Agent Scores</p>
                                {[
                                  ["Forensic (Claude)",  stock.forensic_score],
                                  ["Macro (Gemini)",     stock.macro_score],
                                  ["Asymmetry (DeepSeek)", stock.asymmetry_score],
                                  ["Composite",         stock.composite_score],
                                ].map(([label, score]) => {
                                  if (score == null) return null;
                                  const s = score as number;
                                  const color = s >= 65 ? "#34c759" : s >= 45 ? "#ff9f0a" : "#ff3b30";
                                  return (
                                    <div key={label as string} className="mb-1.5">
                                      <div className="flex justify-between text-[10px] mb-0.5">
                                        <span className="text-[#6e6e73]">{label as string}</span>
                                        <span className="font-medium text-[#1d1d1f]">{s.toFixed(1)}</span>
                                      </div>
                                      <div className="h-1 bg-[#e5e5ea] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${s}%`, background: color }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Hurdle math */}
                              <div>
                                <p className="text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-2">Hurdle Math</p>
                                <div className="space-y-1.5">
                                  {[
                                    ["Expected", `${stock.expected_return?.toFixed(1) ?? "—"}%`, stock.expected_return != null ? (stock.expected_return >= hurdle ? "#34c759" : "#ff3b30") : "#6e6e73"],
                                    ["Required", `${hurdle.toFixed(1)}%`, "#1d1d1f"],
                                    ["Excess",   excess != null ? `${excess >= 0 ? "+" : ""}${excess.toFixed(1)}%` : "—", excess != null ? (excess >= 0 ? "#34c759" : "#ff3b30") : "#6e6e73"],
                                    ["Confidence", `${stock.confidence?.toFixed(0) ?? "—"}%`, "#1d1d1f"],
                                  ].map(([l, v, c]) => (
                                    <div key={l as string} className="flex justify-between text-[11px]">
                                      <span className="text-[#6e6e73]">{l as string}</span>
                                      <span className="font-semibold" style={{ color: c as string }}>{v as string}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Summary */}
                              <div>
                                <p className="text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-2">AI Rationale</p>
                                {stock.decision_summary ? (
                                  <p className="text-[11px] text-[#3a3a3c] leading-relaxed">{stock.decision_summary}</p>
                                ) : (
                                  <p className="text-[11px] text-[#aeaeb2]">No summary available.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Buy Modal */}
      {buyTarget && (
        <BuyModal
          symbol={buyTarget.symbol}
          company_name={buyTarget.company_name}
          sector={buyTarget.sector}
          current_price={buyTarget.price}
          expected_return={buyTarget.expected_return}
          hurdle_rate={hurdle}
          profile_id={profile.id}
          profile_name={profile.name}
          available_balance={userBalance ?? 10000}
          token={token}
          onClose={() => setBuyTarget(null)}
          onSuccess={() => {
            setBuyTarget(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ── Market Page ───────────────────────────────────────────────────────────────
export default function MarketPage() {
  const router = useRouter();
  const { profiles, profilesLoaded, userEmail, isSuperuser, refreshProfiles } = useScan();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [allResults, setAllResults] = useState<Record<number, MarketResult[]>>({});
  const [scannedAts, setScannedAts] = useState<Record<number, string | null>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Get session first, then do a fresh profile fetch so we never show
    // stale ScanContext state (which can be empty from a previous load)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
      await refreshProfiles();
      // Load user wallet balance
      fetch("/api/vip/portfolio", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json()).then((d) => { if (d.wallet) setUserBalance(d.wallet.current_balance); })
        .catch(() => {});
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchForProfile = useCallback(async (profile: Profile, tok: string) => {
    setLoadingMap((p) => ({ ...p, [profile.id]: true }));
    const params = new URLSearchParams({ universe: profile.universe_key });
    if (profile.universe_key === "manual") params.set("profile_id", String(profile.id));
    const res = await fetch(`/api/market/results?${params}`, {
      headers: { Authorization: `Bearer ${tok}` }, cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setAllResults((p) => ({ ...p, [profile.id]: json.results ?? [] }));
      setScannedAts((p) => ({ ...p, [profile.id]: json.scanned_at ?? null }));
    }
    setLoadingMap((p) => ({ ...p, [profile.id]: false }));
  }, []);

  useEffect(() => {
    if (!token || profiles.length === 0) return;
    profiles.forEach((p) => fetchForProfile(p, token));
  }, [token, profiles, fetchForProfile]);

  async function handleDelete(profileId: number) {
    await refreshProfiles();
    setAllResults((p) => { const n = { ...p }; delete n[profileId]; return n; });
    setScannedAts((p) => { const n = { ...p }; delete n[profileId]; return n; });
  }

  if (!profilesLoaded || !token || !ready) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col" style={APPLE}>
        <nav className="bg-[rgba(245,245,247,0.9)] border-b border-black/[0.06] h-14" />
        <div className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
          {/* Skeleton */}
          <div className="h-8 w-56 bg-[#e5e5ea] rounded-xl mb-2 animate-pulse" />
          <div className="h-4 w-72 bg-[#f0f0f0] rounded-lg mb-6 animate-pulse" />
          <div className="rounded-2xl border border-black/[0.06] bg-white h-40 mb-6 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-black/[0.06] bg-white h-24 animate-pulse" />
            <div className="rounded-2xl border border-black/[0.06] bg-white h-24 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1d1d1f]">Finance Decision Machine</span>
          <div className="flex items-center gap-5">
            <span className="text-[13px] text-[#6e6e73] hidden sm:block">{userEmail}</span>
            {isSuperuser && (
              <Link href="/admin/prompts" className="text-[13px] text-[#c2410c] hover:underline font-medium">Admin</Link>
            )}
            <Link href="/portfolio"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors"
              style={{ background: "#f0fdf4", color: "#16a34a" }}>
              💰 {userBalance !== null ? `$${userBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "VIP Portfolio"}
            </Link>
            <Link href="/profile" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">My Profiles</Link>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 pb-16 flex-1">
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="text-[48px] mb-4">📊</div>
            <h1 className="text-[28px] font-semibold text-[#1d1d1f] mb-2">Welcome to Market Intelligence</h1>
            <p className="text-[15px] text-[#6e6e73] mb-8 max-w-md">
              Create an investment profile — choose a stock universe, set your hurdle rate, and get AI-powered signals every morning.
            </p>
            <Link href="/profile/new"
              className="px-8 py-3 rounded-xl text-[15px] font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: "#0071e3" }}>
              Create Your First Profile →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h1 className="text-[38px] font-black text-[#1d1d1f] tracking-tight">Market Intelligence</h1>
                <p className="text-[14px] text-[#6e6e73] mt-1">AI-powered signals · weekday 9 AM auto-scan</p>
              </div>
              <Link href="/profile/new"
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: "#0071e3" }}>
                + New Profile
              </Link>
            </div>

            {/* Section 1 — Summary */}
            <SummarySection profiles={profiles} allResults={allResults} />

            {/* Section 2 — Per-profile panels */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Your Profiles</h2>
              <Link href="/profile" className="text-[12px] text-[#0071e3] hover:underline">Manage →</Link>
            </div>

            <div className={profiles.length === 1
              ? ""
              : "grid gap-4 grid-cols-1 lg:grid-cols-2"}>
              {profiles.map((profile) => (
                <ProfilePanel
                  key={profile.id}
                  profile={profile}
                  token={token}
                  results={allResults[profile.id] ?? []}
                  scannedAt={scannedAts[profile.id] ?? null}
                  loading={loadingMap[profile.id] ?? true}
                  userBalance={userBalance}
                  onRefresh={() => fetchForProfile(profile, token)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-black/[0.06] py-5 text-center">
        <p className="text-[11px] text-[#aeaeb2]">Copyright © 2026 Finance Decision Machine. All rights reserved.</p>
      </footer>
    </div>
  );
}
