"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

interface Portfolio { id: number; profile_id: number; current_balance: number; initial_balance: number; profiles: { name: string; investment_period: string } }
interface Position {
  id: number; portfolio_id: number; profile_id: number;
  symbol: string; company_name: string; sector: string;
  quantity: number; buy_price: number; buy_amount: number;
  target_price: number; hurdle_rate: number; expected_return: number | null;
  current_price: number | null; current_value: number | null;
  status: "holding" | "target_hit" | "sold";
  bought_at: string; price_updated_at: string | null;
}
interface Transaction { id: number; type: string; symbol: string; quantity: number; price: number; amount: number; balance_after: number; created_at: string; profile_id: number }

function pct(a: number, b: number) { return ((a - b) / b * 100); }
function fmt(n: number) { return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2); }

export default function PortfolioPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selling, setSelling] = useState<number | null>(null);
  const [confirmSell, setConfirmSell] = useState<number | null>(null);

  const load = useCallback(async (tok: string) => {
    const res = await fetch("/api/vip/portfolio", { headers: { Authorization: `Bearer ${tok}` }, cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      setPortfolios(json.portfolios ?? []);
      setPositions(json.positions ?? []);
      setTransactions(json.transactions ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
      load(session.access_token);
    });
  }, [router, load]);

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    await fetch("/api/vip/refresh-prices", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
    await load(token);
    setRefreshing(false);
  }

  async function handleSell(positionId: number) {
    if (!token) return;
    setSelling(positionId);
    setConfirmSell(null);
    const res = await fetch("/api/vip/sell", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ position_id: positionId }) });
    if (res.ok) await load(token);
    setSelling(null);
  }

  // Global summary
  const totalInvested   = positions.reduce((s, p) => s + p.buy_amount, 0);
  const totalValue      = positions.reduce((s, p) => s + (p.current_value ?? p.buy_amount), 0);
  const totalPnL        = totalValue - totalInvested;
  const totalBalance    = portfolios.reduce((s, p) => s + p.current_balance, 0);
  const targetHitCount  = positions.filter((p) => p.status === "target_hit").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={APPLE}>
        <p className="text-[#6e6e73]">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/market" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">← Market</Link>
            <span className="text-[15px] font-semibold text-[#1d1d1f]">VIP Portfolio</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/portfolio/health" className="text-[13px] text-[#0071e3] hover:underline">Health Report →</Link>
            <button onClick={handleRefresh} disabled={refreshing}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] disabled:opacity-40 transition-colors">
              {refreshing ? "Refreshing…" : "↻ Refresh Prices"}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 pb-16 flex-1">

        {/* ── Global Summary ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Available Cash",   value: `$${totalBalance.toFixed(0)}`,                        sub: "across all profiles",   color: "#0071e3" },
            { label: "Invested",         value: `$${totalInvested.toFixed(0)}`,                       sub: `in ${positions.length} positions`, color: "#1d1d1f" },
            { label: "Current Value",    value: `$${totalValue.toFixed(0)}`,                          sub: "at last known price",   color: "#1d1d1f" },
            { label: "Total P&L",        value: `${fmt(totalPnL)} (${fmt(pct(totalValue, totalInvested))}%)`, sub: "unrealised",     color: totalPnL >= 0 ? "#16a34a" : "#dc2626" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-black/[0.08] p-5">
              <p className="text-[11px] text-[#aeaeb2] uppercase tracking-wide mb-1">{label}</p>
              <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
              <p className="text-[11px] text-[#aeaeb2] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Target Hit Alerts ── */}
        {targetHitCount > 0 && (
          <div className="rounded-2xl border-2 p-5 mb-6" style={{ borderColor: "#16a34a", background: "#f0fdf4" }}>
            <p className="text-[15px] font-bold mb-3" style={{ color: "#15803d" }}>🏆 {targetHitCount} position{targetHitCount !== 1 ? "s" : ""} hit target price!</p>
            <div className="space-y-2">
              {positions.filter((p) => p.status === "target_hit").map((p) => {
                const gain = (p.current_price ?? p.buy_price) - p.buy_price;
                const gainPct = pct(p.current_price ?? p.buy_price, p.buy_price);
                return (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 flex-wrap gap-2">
                    <div>
                      <span className="text-[14px] font-bold text-[#1d1d1f]">{p.symbol}</span>
                      <span className="text-[12px] text-[#6e6e73] ml-2">{p.company_name}</span>
                      <span className="text-[12px] font-semibold ml-3" style={{ color: "#16a34a" }}>
                        ${(p.current_price ?? p.buy_price).toFixed(2)} (+{gainPct.toFixed(1)}%) · Profit ${(gain * p.quantity).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {confirmSell === p.id ? (
                        <>
                          <button onClick={() => setConfirmSell(null)} className="px-3 py-1.5 rounded-lg text-[12px] bg-[#f5f5f7] text-[#6e6e73]">Cancel</button>
                          <button onClick={() => handleSell(p.id)} disabled={selling === p.id}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-[#16a34a] disabled:opacity-40">
                            {selling === p.id ? "Selling…" : "Confirm Sell"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setConfirmSell(p.id)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: "#16a34a" }}>Sell</button>
                          <button className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#0071e3] bg-[#f0f6ff]">Hold</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Per-profile holdings ── */}
        {portfolios.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.08] p-10 text-center">
            <p className="text-[15px] text-[#6e6e73] mb-2">No virtual investments yet.</p>
            <p className="text-[13px] text-[#aeaeb2]">Go to <Link href="/market" className="text-[#0071e3] hover:underline">Market Intelligence</Link> and click Buy on any stock.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {portfolios.map((portfolio) => {
              const profilePositions = positions.filter((p) => p.profile_id === portfolio.profile_id);
              const profileInvested  = profilePositions.reduce((s, p) => s + p.buy_amount, 0);
              const profileValue     = profilePositions.reduce((s, p) => s + (p.current_value ?? p.buy_amount), 0);
              const profilePnL       = profileValue - profileInvested;

              return (
                <div key={portfolio.id} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                  {/* Profile header */}
                  <div className="px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-[17px] font-bold text-[#1d1d1f]">{portfolio.profiles?.name}</h2>
                      <div className="flex items-center gap-4 mt-1 text-[12px] text-[#6e6e73]">
                        <span>💰 ${portfolio.current_balance.toFixed(0)} available</span>
                        <span>📈 ${profileInvested.toFixed(0)} invested</span>
                        <span style={{ color: profilePnL >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                          P&L {fmt(profilePnL)} ({profilePositions.length > 0 ? fmt(pct(profileValue, profileInvested)) : "0.00"}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[#aeaeb2]">Portfolio Value</p>
                      <p className="text-[20px] font-bold text-[#1d1d1f]">${(portfolio.current_balance + profileValue).toFixed(0)}</p>
                    </div>
                  </div>

                  {profilePositions.length === 0 ? (
                    <p className="text-[13px] text-[#aeaeb2] text-center py-6">No holdings in this profile yet.</p>
                  ) : (
                    <div>
                      {/* Column headers */}
                      <div className="grid px-6 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#aeaeb2]"
                        style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem 5rem 7rem 6rem" }}>
                        <span></span><span>Stock</span><span className="text-right">Bought</span>
                        <span className="text-right">Current</span><span className="text-right">Target</span>
                        <span className="text-right">P&L</span><span className="text-right">Progress</span>
                        <span className="text-right">Action</span>
                      </div>
                      {profilePositions.map((pos) => {
                        const curPrice   = pos.current_price ?? pos.buy_price;
                        const curValue   = pos.quantity * curPrice;
                        const posGain    = curValue - pos.buy_amount;
                        const posGainPct = pct(curPrice, pos.buy_price);
                        const progress   = Math.min(100, Math.max(0, (posGainPct / pos.hurdle_rate) * 100));
                        const isHit      = pos.status === "target_hit";

                        return (
                          <div key={pos.id}
                            className="grid px-6 py-3 items-center border-t border-[#f0f0f0] hover:bg-[#fafafa] transition-colors text-[13px]"
                            style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem 5rem 7rem 6rem" }}>
                            {/* Status icon */}
                            <span className="text-[16px]">{isHit ? "🏆" : posGain >= 0 ? "▲" : "▼"}</span>
                            {/* Name */}
                            <div>
                              <span className="font-bold text-[#1d1d1f]">{pos.symbol}</span>
                              <span className="text-[#aeaeb2] ml-2 hidden sm:inline">{pos.company_name}</span>
                              <div className="text-[10px] text-[#aeaeb2]">{pos.quantity.toFixed(2)} shares · {pos.sector}</div>
                            </div>
                            {/* Buy price */}
                            <span className="text-right text-[#6e6e73]">${pos.buy_price.toFixed(2)}</span>
                            {/* Current */}
                            <span className="text-right font-semibold text-[#1d1d1f]">${curPrice.toFixed(2)}</span>
                            {/* Target */}
                            <span className="text-right text-[#6e6e73]">${pos.target_price.toFixed(2)}</span>
                            {/* P&L */}
                            <span className="text-right font-semibold" style={{ color: posGain >= 0 ? "#16a34a" : "#dc2626" }}>
                              {fmt(posGainPct)}%
                            </span>
                            {/* Progress bar */}
                            <div className="px-1">
                              <div className="h-1.5 bg-[#e5e5ea] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${progress}%`, background: isHit ? "#16a34a" : progress > 60 ? "#ff9f0a" : "#0071e3" }} />
                              </div>
                              <p className="text-[9px] text-[#aeaeb2] mt-0.5 text-right">{progress.toFixed(0)}% to target</p>
                            </div>
                            {/* Action */}
                            <div className="flex justify-end">
                              {confirmSell === pos.id ? (
                                <div className="flex gap-1">
                                  <button onClick={() => setConfirmSell(null)} className="px-2 py-1 rounded text-[10px] bg-[#f5f5f7] text-[#6e6e73]">✕</button>
                                  <button onClick={() => handleSell(pos.id)} disabled={selling === pos.id}
                                    className="px-2 py-1 rounded text-[10px] font-semibold text-white bg-red-500 disabled:opacity-40">
                                    {selling === pos.id ? "…" : "Sell"}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmSell(pos.id)}
                                  className="px-3 py-1 rounded-lg text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                                  Sell
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Recent Transactions ── */}
        {transactions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[16px] font-bold text-[#1d1d1f] mb-3">Recent Transactions</h2>
            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
              {transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] px-2 py-0.5 rounded font-semibold"
                      style={{ background: tx.type === "buy" ? "#f0f6ff" : "#fde8e8", color: tx.type === "buy" ? "#0071e3" : "#dc2626" }}>
                      {tx.type.toUpperCase()}
                    </span>
                    <div>
                      <span className="text-[13px] font-semibold text-[#1d1d1f]">{tx.symbol}</span>
                      <span className="text-[11px] text-[#6e6e73] ml-2">{tx.quantity.toFixed(2)} shares @ ${tx.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-semibold" style={{ color: tx.type === "buy" ? "#dc2626" : "#16a34a" }}>
                      {tx.type === "buy" ? "-" : "+"}${tx.amount.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-[#aeaeb2]">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-black/[0.06] py-5 text-center">
        <p className="text-[11px] text-[#aeaeb2]">Virtual portfolio — not real money. For learning purposes only.</p>
      </footer>
    </div>
  );
}
