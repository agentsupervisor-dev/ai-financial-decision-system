"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

function fmt(n: number) { return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2); }
function fmtPct(n: number) { return n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`; }

export default function HealthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ portfolios: never[]; positions: never[]; transactions: never[] } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      const res = await fetch("/api/vip/portfolio", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      if (res.ok) setData(await res.json());
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={APPLE}><p className="text-[#6e6e73]">Loading…</p></div>;
  }

  const portfolios  = (data?.portfolios ?? []) as { id: number; profile_id: number; current_balance: number; initial_balance: number; profiles: { name: string } }[];
  const allPositions = (data?.positions ?? []) as { id: number; profile_id: number; symbol: string; company_name: string; sector: string; buy_price: number; buy_amount: number; current_price: number | null; current_value: number | null; quantity: number; hurdle_rate: number; target_price: number; status: string; bought_at: string }[];
  const allTx       = (data?.transactions ?? []) as { id: number; type: string; symbol: string; amount: number; price: number; quantity: number; balance_after: number; created_at: string; profile_id: number }[];

  const sellTx = allTx.filter((t) => t.type === "sell");
  const buyTx  = allTx.filter((t) => t.type === "buy");

  // Realised P&L from sell transactions
  const realisedPnL = sellTx.reduce((sum, tx) => {
    const matchBuy = buyTx.find((b) => b.symbol === tx.symbol);
    if (!matchBuy) return sum;
    return sum + (tx.price - matchBuy.price) * tx.quantity;
  }, 0);

  // Unrealised P&L from active positions
  const unrealisedPnL = allPositions.reduce((sum, p) => {
    const cur = p.current_value ?? p.buy_amount;
    return sum + (cur - p.buy_amount);
  }, 0);

  // By sector
  const bySector: Record<string, { invested: number; value: number; count: number }> = {};
  for (const p of allPositions) {
    const s = p.sector ?? "Other";
    if (!bySector[s]) bySector[s] = { invested: 0, value: 0, count: 0 };
    bySector[s].invested += p.buy_amount;
    bySector[s].value += p.current_value ?? p.buy_amount;
    bySector[s].count++;
  }

  // Best / worst performers
  const ranked = [...allPositions].sort((a, b) => {
    const aGain = ((a.current_price ?? a.buy_price) - a.buy_price) / a.buy_price;
    const bGain = ((b.current_price ?? b.buy_price) - b.buy_price) / b.buy_price;
    return bGain - aGain;
  });

  const totalInvested = allPositions.reduce((s, p) => s + p.buy_amount, 0);
  const totalValue    = allPositions.reduce((s, p) => s + (p.current_value ?? p.buy_amount), 0);
  const totalBalance  = portfolios.reduce((s, p) => s + p.current_balance, 0);
  const netWorth      = totalBalance + totalValue;
  const totalStarting = portfolios.reduce((s, p) => s + p.initial_balance, 0);
  const netReturn     = netWorth - totalStarting;
  const targetHit     = allPositions.filter((p) => p.status === "target_hit").length;

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portfolio" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">← Portfolio</Link>
            <span className="text-[15px] font-semibold text-[#1d1d1f]">Investment Health</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 pb-16 flex-1">
        <h1 className="text-[34px] font-black text-[#1d1d1f] tracking-tight mb-1">Investment Health</h1>
        <p className="text-[14px] text-[#6e6e73] mb-8">Complete picture of your virtual portfolio performance</p>

        {/* ── Overall P&L ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Net Worth",       value: `$${netWorth.toFixed(0)}`,             sub: `started with $${totalStarting.toFixed(0)}`,    color: "#1d1d1f" },
            { label: "Net Return",      value: `${fmt(netReturn)}`,                    sub: fmtPct(totalStarting > 0 ? (netReturn / totalStarting) * 100 : 0), color: netReturn >= 0 ? "#16a34a" : "#dc2626" },
            { label: "Unrealised P&L",  value: `${fmt(unrealisedPnL)}`,               sub: `${allPositions.length} active positions`,       color: unrealisedPnL >= 0 ? "#16a34a" : "#dc2626" },
            { label: "Targets Hit",     value: `${targetHit}`,                        sub: `of ${allPositions.length} positions`,            color: "#0071e3" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-black/[0.08] p-5">
              <p className="text-[11px] text-[#aeaeb2] uppercase tracking-wide mb-1">{label}</p>
              <p className="text-[24px] font-bold" style={{ color }}>{value}</p>
              <p className="text-[11px] text-[#aeaeb2] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ── By Sector ── */}
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6">
            <h2 className="text-[16px] font-bold text-[#1d1d1f] mb-4">By Sector</h2>
            {Object.keys(bySector).length === 0 ? (
              <p className="text-[13px] text-[#aeaeb2]">No positions yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(bySector).sort((a, b) => b[1].invested - a[1].invested).map(([sector, d]) => {
                  const gainPct = d.invested > 0 ? ((d.value - d.invested) / d.invested) * 100 : 0;
                  const share   = totalInvested > 0 ? (d.invested / totalInvested) * 100 : 0;
                  return (
                    <div key={sector}>
                      <div className="flex justify-between text-[13px] mb-1">
                        <span className="font-medium text-[#1d1d1f]">{sector} <span className="text-[#aeaeb2] font-normal">({d.count})</span></span>
                        <span className="font-semibold" style={{ color: gainPct >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPct(gainPct)}</span>
                      </div>
                      <div className="h-2 bg-[#e5e5ea] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#0071e3]" style={{ width: `${share}%` }} />
                      </div>
                      <p className="text-[10px] text-[#aeaeb2] mt-0.5">{share.toFixed(0)}% of portfolio · ${d.invested.toFixed(0)} invested</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Best / Worst ── */}
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6">
            <h2 className="text-[16px] font-bold text-[#1d1d1f] mb-4">Performers</h2>
            {ranked.length === 0 ? (
              <p className="text-[13px] text-[#aeaeb2]">No positions yet.</p>
            ) : (
              <div className="space-y-2">
                {ranked.map((p, i) => {
                  const gain    = (p.current_price ?? p.buy_price) - p.buy_price;
                  const gainPct = (gain / p.buy_price) * 100;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold w-5 text-[#aeaeb2]">#{i + 1}</span>
                        <div>
                          <span className="text-[13px] font-bold text-[#1d1d1f]">{p.symbol}</span>
                          <span className="text-[11px] text-[#aeaeb2] ml-1.5">{p.sector}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold" style={{ color: gainPct >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPct(gainPct)}</p>
                        <p className="text-[10px] text-[#aeaeb2]">{fmt(gain * p.quantity)} total</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Per-profile breakdown ── */}
        <h2 className="text-[16px] font-bold text-[#1d1d1f] mb-3">Per Profile Summary</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {portfolios.map((port) => {
            const pos = allPositions.filter((p) => p.profile_id === port.profile_id);
            const invested = pos.reduce((s, p) => s + p.buy_amount, 0);
            const value    = pos.reduce((s, p) => s + (p.current_value ?? p.buy_amount), 0);
            const pnl      = value - invested;
            const portNetWorth = port.current_balance + value;
            const portReturn   = portNetWorth - port.initial_balance;
            return (
              <div key={port.id} className="bg-white rounded-2xl border border-black/[0.08] p-5">
                <h3 className="text-[15px] font-bold text-[#1d1d1f] mb-3">{port.profiles?.name}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Starting",   `$${port.initial_balance.toFixed(0)}`,   "#6e6e73"],
                    ["Net Worth",  `$${portNetWorth.toFixed(0)}`,            "#1d1d1f"],
                    ["Cash Left",  `$${port.current_balance.toFixed(0)}`,   "#0071e3"],
                    ["P&L",        `${fmt(pnl)}`,                            pnl >= 0 ? "#16a34a" : "#dc2626"],
                  ].map(([label, val, color]) => (
                    <div key={label as string}>
                      <p className="text-[10px] text-[#aeaeb2] uppercase tracking-wide">{label as string}</p>
                      <p className="text-[16px] font-bold" style={{ color: color as string }}>{val as string}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6e6e73]">Overall return</span>
                    <span className="font-bold" style={{ color: portReturn >= 0 ? "#16a34a" : "#dc2626" }}>
                      {fmt(portReturn)} ({fmtPct((portReturn / port.initial_balance) * 100)})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Transaction history ── */}
        <h2 className="text-[16px] font-bold text-[#1d1d1f] mb-3">Full Transaction History</h2>
        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
          {allTx.length === 0 ? (
            <p className="text-[13px] text-[#aeaeb2] text-center py-8">No transactions yet.</p>
          ) : allTx.map((tx) => (
            <div key={tx.id} className="grid items-center px-5 py-3 border-b border-[#f0f0f0] last:border-0 text-[12px]"
              style={{ gridTemplateColumns: "3rem 3rem 1fr 5rem 5rem 5rem" }}>
              <span className="text-[10px] text-[#aeaeb2]">{new Date(tx.created_at).toLocaleDateString()}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold w-fit"
                style={{ background: tx.type === "buy" ? "#f0f6ff" : "#f0fdf4", color: tx.type === "buy" ? "#0071e3" : "#16a34a" }}>
                {tx.type.toUpperCase()}
              </span>
              <span className="font-semibold text-[#1d1d1f]">{tx.symbol} <span className="text-[#aeaeb2] font-normal">× {tx.quantity.toFixed(2)}</span></span>
              <span className="text-right text-[#6e6e73]">${tx.price.toFixed(2)}</span>
              <span className="text-right font-semibold" style={{ color: tx.type === "buy" ? "#dc2626" : "#16a34a" }}>
                {tx.type === "buy" ? "-" : "+"}${tx.amount.toFixed(2)}
              </span>
              <span className="text-right text-[#aeaeb2]">${tx.balance_after.toFixed(0)} left</span>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-black/[0.06] py-5 text-center">
        <p className="text-[11px] text-[#aeaeb2]">Virtual portfolio — not real money. For learning purposes only.</p>
      </footer>
    </div>
  );
}
